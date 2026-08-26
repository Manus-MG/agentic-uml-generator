import Groq from 'groq-sdk';
import {
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from 'groq-sdk/core/error';
import pLimit from 'p-limit';
import type { z } from 'zod';
import { env } from '../../config/env.js';
import { toStrictJsonSchema } from '../schemas/strictJsonSchema.js';
import { estimateTokens, sharedBudget } from './tokenBudget.js';

export type ReasoningEffort = 'low' | 'medium' | 'high';
export type ModelRole = 'primary' | 'fast';

export interface StructuredCallOptions<T> {
  /** Schema the response is constrained to. Must be strict-mode compatible. */
  schema: z.ZodType<T>;
  /** Identifies the schema to Groq; also the label used in trajectories. */
  schemaName: string;
  system: string;
  user: string;
  role?: ModelRole;
  effort?: ReasoningEffort;
  maxTokens?: number;
  /**
   * `hidden` drops the reasoning entirely; `parsed` returns it separately so it
   * can be recorded on the trajectory. Groq rejects `raw` alongside JSON mode.
   */
  captureReasoning?: boolean;
}

export interface StructuredCallResult<T> {
  value: T;
  raw: string;
  reasoning: string | null;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  /** Wall-clock duration including retries. */
  durationMs: number;
  attempts: number;
  /** The exact messages sent, retained for ART trajectory export. */
  messages: { role: 'system' | 'user'; content: string }[];
}

let client: Groq | null = null;
let limit: ReturnType<typeof pLimit> | null = null;

function getClient(): Groq {
  if (!client) client = new Groq({ apiKey: env().GROQ_API_KEY });
  return client;
}

/** Test seam: inject a stub client so the graph can be exercised without network. */
export function setClientForTesting(next: Groq | null): void {
  client = next;
}

function gate(): ReturnType<typeof pLimit> {
  if (!limit) limit = pLimit(env().LLM_CONCURRENCY);
  return limit;
}

function modelFor(role: ModelRole): string {
  return role === 'fast' ? env().MODEL_FAST : env().MODEL_PRIMARY;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate-limit' | 'bad-request' | 'server' | 'network' | 'parse' | 'too-large',
    readonly retryable: boolean,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/**
 * Classifies a Groq failure into "worth retrying" and "not".
 *
 * Retrying a 400 because the schema is malformed just burns the run's budget
 * four times before failing anyway, so the distinction is load-bearing.
 */
function classify(error: unknown): LlmError {
  // A 413 means this single request is bigger than the per-minute budget.
  // Retrying it unchanged can never succeed, so it must not look retryable.
  const status = (error as { status?: number })?.status;
  const detail = (error as { message?: string })?.message ?? '';
  if (status === 413 || /request too large/i.test(detail)) {
    return new LlmError(
      `Request exceeds the account's per-minute token limit. Reduce max_completion_tokens or the ` +
        `prompt size for this call. Groq said: ${detail}`,
      'too-large',
      false,
      error,
    );
  }
  if (error instanceof RateLimitError) {
    return new LlmError('Groq rate limit exceeded', 'rate-limit', true, error);
  }
  if (error instanceof AuthenticationError) {
    return new LlmError('Groq rejected the API key — check GROQ_API_KEY', 'auth', false, error);
  }
  if (error instanceof BadRequestError) {
    const detail = (error as { message?: string }).message ?? '';
    // `json_validate_failed` means the constrained decoder could not finish a
    // valid document — nearly always because the completion hit its token cap
    // mid-object. The request itself is fine, and a resample often fits, so
    // this one 400 is worth retrying where the others are not.
    if (/json_validate_failed/i.test(detail)) {
      return new LlmError(
        `Groq could not complete valid JSON for this call — it most likely ran out of completion ` +
          `tokens. Raise its maxTokens or ask for less. Groq said: ${detail.slice(0, 200)}`,
        'parse',
        true,
        error,
      );
    }
    return new LlmError(`Groq rejected the request: ${detail}`, 'bad-request', false, error);
  }
  if (error instanceof InternalServerError) {
    return new LlmError('Groq server error', 'server', true, error);
  }
  if (error instanceof APIConnectionError) {
    return new LlmError('Could not reach Groq', 'network', true, error);
  }
  if (error instanceof LlmError) return error;
  return new LlmError(
    error instanceof Error ? error.message : 'Unknown LLM failure',
    'server',
    true,
    error,
  );
}

/** Honours `retry-after` when Groq sends it; otherwise exponential backoff with jitter. */
function backoffMs(attempt: number, error: unknown): number {
  const headers = (error as { headers?: Headers })?.headers;
  const retryAfter = headers?.get?.('retry-after');
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 60_000);
  }
  const base = Math.min(1000 * 2 ** attempt, 30_000);
  return base + Math.random() * 250;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The single entry point for every LLM call in the system.
 *
 * Groq specifics worth knowing when reading this:
 *
 *   - strict `json_schema` (constrained decoding, guaranteed schema adherence)
 *     is only supported on the gpt-oss models, which is why MODEL_PRIMARY
 *     defaults to `openai/gpt-oss-120b`. On any other model this silently
 *     degrades to best-effort JSON.
 *   - `reasoning_format` must be `hidden` or `parsed` when JSON mode is on;
 *     `raw` returns a 400.
 *   - streaming and tool use are not available alongside structured outputs.
 *     That costs us nothing: progress is streamed to the client at the graph
 *     level over SSE, not token by token.
 *   - there is no prompt caching, so prompts stay slice-scoped rather than
 *     shipping the whole CSM on every call.
 */
export async function callStructured<T>(options: StructuredCallOptions<T>): Promise<StructuredCallResult<T>> {
  const {
    schema,
    schemaName,
    system,
    user,
    role = 'primary',
    effort = 'medium',
    maxTokens = 8192,
    captureReasoning = false,
  } = options;

  const jsonSchema = toStrictJsonSchema(schema, schemaName);
  const model = modelFor(role);
  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];

  // Groq counts max_completion_tokens toward the request size, so the estimate
  // has to include it or we pace against the wrong number.
  const estimate =
    estimateTokens(system) + estimateTokens(user) + estimateTokens(JSON.stringify(jsonSchema)) + maxTokens;

  if (sharedBudget.exceedsLimit(estimate)) {
    throw new LlmError(
      `The "${schemaName}" call needs ~${estimate} tokens but the account allows ` +
        `${sharedBudget.getLimit()} per minute. Lower its maxTokens or split the call.`,
      'too-large',
      false,
    );
  }

  return gate()(async () => {
    const startedAt = Date.now();
    let lastError: LlmError | null = null;

    for (let attempt = 0; attempt <= env().LLM_MAX_RETRIES; attempt += 1) {
      try {
        const wait = sharedBudget.waitFor(estimate);
        if (wait > 0) await sleep(wait);
        sharedBudget.reserve(estimate);

        const completion = await getClient().chat.completions.create({
          model,
          messages,
          max_completion_tokens: maxTokens,
          reasoning_effort: effort,
          reasoning_format: captureReasoning ? 'parsed' : 'hidden',
          response_format: {
            type: 'json_schema',
            json_schema: { name: schemaName, strict: true, schema: jsonSchema },
          },
        });

        const choice = completion.choices[0];
        const content = choice?.message?.content ?? '';
        if (content.trim() === '') {
          throw new LlmError(`Model returned an empty ${schemaName} response`, 'parse', true);
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(content);
        } catch {
          throw new LlmError(`Model returned unparseable JSON for ${schemaName}`, 'parse', true);
        }

        const result = schema.safeParse(parsedJson);
        if (!result.success) {
          // Constrained decoding should make this impossible; if it happens the
          // model is not one that supports strict mode.
          const detail = result.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          throw new LlmError(
            `Response did not match ${schemaName} (is ${model} a strict-mode model?): ${detail}`,
            'parse',
            true,
          );
        }

        sharedBudget.reconcile(estimate, completion.usage?.total_tokens ?? estimate);

        return {
          value: result.data,
          raw: content,
          reasoning: (choice?.message as { reasoning?: string } | undefined)?.reasoning ?? null,
          model: completion.model ?? model,
          usage: {
            promptTokens: completion.usage?.prompt_tokens ?? 0,
            completionTokens: completion.usage?.completion_tokens ?? 0,
            totalTokens: completion.usage?.total_tokens ?? 0,
          },
          durationMs: Date.now() - startedAt,
          attempts: attempt + 1,
          messages,
        };
      } catch (error) {
        sharedBudget.observeHeaders((error as { headers?: Headers })?.headers);
        lastError = classify(error);
        if (!lastError.retryable || attempt === env().LLM_MAX_RETRIES) break;
        await sleep(backoffMs(attempt, error));
      }
    }

    throw lastError ?? new LlmError('LLM call failed for an unknown reason', 'server', false);
  });
}
