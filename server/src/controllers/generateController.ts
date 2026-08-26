import type { Request, Response } from 'express';
import { z } from 'zod';
import { runSwitchView, runTurn, safeSegment, type RunEvent } from '../agent/pipeline.js';
import { Diagram } from '../models/Diagram.js';
import { Thread } from '../models/Thread.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { SseStream, wantsSse } from '../lib/sse.js';

/**
 * The brief's payload uses snake_case (`diagram_types`), so that is what the
 * API accepts. camelCase is accepted alongside it because the TypeScript client
 * naturally sends that, and rejecting it would be a pointless trap.
 */
const GenerateBody = z
  .object({
    prompt: z.string().min(1, 'prompt is required'),
    diagram_types: z.array(z.string()).optional(),
    diagramTypes: z.array(z.string()).optional(),
    user_id: z.string().optional(),
    userId: z.string().optional(),
  })
  .transform((body) => ({
    prompt: body.prompt,
    diagramTypes: body.diagram_types ?? body.diagramTypes,
    userId: body.user_id ?? body.userId,
  }));

const SwitchViewBody = z
  .object({
    diagram_type: z.string().optional(),
    diagramType: z.string().optional(),
  })
  .transform((body, ctx) => {
    const value = body.diagram_type ?? body.diagramType;
    if (!value) {
      ctx.addIssue({ code: 'custom', message: 'diagram_type is required' });
      return z.NEVER;
    }
    return { diagramType: value };
  });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw badRequest('Invalid request body', result.error.issues.map((i) => i.message));
  }
  return result.data;
}

/**
 * One endpoint covers the brief's first two cases.
 *
 * A session with no stored model is a new user and generates from scratch; a
 * session that already has one is an existing user sending an updated prompt,
 * and the model is patched rather than rebuilt. The client does not have to
 * know which case it is in — and cannot get it wrong.
 */
export async function generate(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };
  const body = parse(GenerateBody, req.body);
  const headerUserId = typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'].trim() : undefined;
  const userId = body.userId || headerUserId;

  if (wantsSse(req.headers.accept)) {
    const stream = new SseStream(res);
    try {
      for await (const event of runTurn({ sessionId, ...body, userId })) {
        if (!stream.isOpen) return; // client hung up; stop doing work for nobody
        stream.send(event.type, event);
      }
    } catch (error) {
      // Headers are already sent, so the error middleware cannot help here.
      stream.send('error', { message: error instanceof Error ? error.message : 'Generation failed' });
    } finally {
      stream.end();
    }
    return;
  }

  const diagrams = new Map<string, RunEvent & { type: 'diagram' }>();
  let done: (RunEvent & { type: 'done' }) | null = null;
  let failed: (RunEvent & { type: 'error' }) | null = null;

  for await (const event of runTurn({ sessionId, ...body, userId })) {
    if (event.type === 'diagram') diagrams.set(event.diagram.type, event);
    else if (event.type === 'done') done = event;
    else if (event.type === 'error') failed = event;
  }

  if (failed) {
    throw failed.kind === 'not-found' ? notFound(failed.message) : badRequest(failed.message);
  }

  res.status(200).json({
    success: true,
    ...done,
    diagrams: [...diagrams.values()].map((e) => e.diagram),
  });
}

/**
 * Renders another view of the model that already exists — the "switch from
 * table to kanban" move. Costs nothing when the stored model already covers the
 * requested view, which the response reports as `llmCalls: 0`.
 */
export async function switchView(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };
  const { diagramType } = parse(SwitchViewBody, req.body);

  const result = await runSwitchView({ sessionId, diagramType });
  res.status(200).json({ success: true, sessionId, ...result });
}

/**
 * The rendered set for a session — the latest version, or `?version=N`.
 *
 * The explicit version is what lets a chat transcript rehydrate the diagrams a
 * *past* turn produced instead of showing every turn the current ones.
 */
export async function listDiagrams(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };

  const thread = await Thread.findOne({ sessionId });
  if (!thread) throw notFound(`No session ${sessionId}`);

  const requested = Number(req.query.version);
  const version = Number.isInteger(requested) && requested > 0 ? requested : thread.currentVersion;

  const diagrams = await Diagram.find({ sessionId, version }).sort({ type: 1 });

  res.status(200).json({
    success: true,
    sessionId,
    version,
    total: diagrams.length,
    diagrams: diagrams.map((d) => ({
      diagramId: String(d._id),
      type: d.type,
      status: 'rendered' as const,
      source: d.source,
      svg: d.svg,
      pngUrl: d.pngPath ? `/api/diagram/${safeSegment(sessionId)}/${d.pngPath.split('/').pop()}` : null,
      valid: d.valid,
      errors: d.renderErrors,
      repairAttempts: d.repairAttempts,
      carriedForward: d.carriedForward,
    })),
  });
}
