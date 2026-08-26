import path from 'node:path';
import { z } from 'zod';
import { env } from '../config/env.js';
import { badRequest, notFound } from '../lib/httpError.js';
import { autoFix, render, renderSvg, validate } from '../plantuml/index.js';
import { CsmVersion } from '../models/CsmVersion.js';
import { Diagram } from '../models/Diagram.js';
import { Thread } from '../models/Thread.js';
import { Trajectory } from '../models/Trajectory.js';
import { resolveDiagramTypes } from './aliases.js';
import { formatIssues, validateCsm, type IntegrityIssue } from './csmIntegrity.js';
import { DIAGRAM_SPECS, missingSlices, type DiagramSpec } from './diagramRegistry.js';
import { callStructured, type StructuredCallResult } from './llm/groq.js';
import {
  ARCHITECT_SYSTEM,
  PLANTUML_REPAIR_SYSTEM,
  REQUIREMENTS_SYSTEM,
  REVISION_SYSTEM,
  csmDigest,
  plantumlRepairPrompt,
  requirementDigest,
  revisionPlanPrompt,
  slicePatchPrompt,
  sliceContent,
  sliceUserPrompt,
} from './llm/prompts.js';
import { emptyCsm, type Csm, type CsmSlice } from './schemas/csm.js';
import { applyPatch } from './schemas/csmPatch.js';
import { RequirementModelSchema } from './schemas/requirements.js';
import {
  RevisionPlanSchema,
  SLICE_PATCH_INSTRUCTIONS,
  SLICE_PATCH_SCHEMAS,
  toCsmPatch,
} from './schemas/slicePatch.js';
import { SLICES, mergeSlice, sliceFor, slicesFor, type SliceName } from './schemas/slices.js';

/**
 * The turn pipeline: prompt in, rendered diagrams out.
 *
 * Written as an async generator rather than a graph library because every
 * consumer wants the same thing — progress as it happens. The SSE controller
 * forwards each event to the browser; the JSON controller drains the generator
 * and keeps the last one. Diagram sources are emitted the moment they are
 * projected, seconds before their PNGs finish rendering, which is most of the
 * perceived-latency win.
 *
 * Two paths share the tail of the pipeline:
 *   generate — no prior model: requirements, then fill the slices the requested
 *              diagrams need.
 *   revise   — a prior model exists: plan which slices move, patch those, and
 *              carry every unaffected diagram forward untouched.
 */

export interface DiagramPayload {
  type: string;
  name: string;
  /**
   * 'projected' is the first event for a diagram: the source exists but has not
   * been through the renderer yet, so `valid` is null rather than false — the
   * difference between "not checked" and "checked and wrong" is what a client
   * needs to decide whether to show a spinner or an error.
   */
  status: 'projected' | 'rendered';
  source: string;
  svg: string | null;
  pngUrl: string | null;
  valid: boolean | null;
  errors: { message: string; line: number | null }[];
  repairAttempts: number;
  /** True when a revision left this diagram's slices alone and the previous render was reused. */
  carriedForward: boolean;
  diagramId: string | null;
}

export interface RunUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  llmCalls: number;
}

export type RunEvent =
  | { type: 'phase'; phase: string; detail: string | null }
  | { type: 'diagram'; diagram: DiagramPayload }
  | {
      type: 'done';
      sessionId: string;
      version: number;
      mode: 'generate' | 'revise';
      diagramTypes: string[];
      unknownTypes: string[];
      changedSlices: string[];
      rationale: string | null;
      integrity: { ok: boolean; errors: IntegrityIssue[]; warnings: IntegrityIssue[] };
      usage: RunUsage;
      ms: number;
    }
  | { type: 'error'; message: string; kind: string | null };

export interface TurnInput {
  sessionId: string;
  prompt: string;
  /** Absent on a revision means "the diagram types this thread already uses". */
  diagramTypes?: string[];
  userId?: string;
}

/** Fallback for a first turn that names no diagram types. */
const DEFAULT_DIAGRAM_TYPES = ['sequence', 'component', 'class'];

/** Working state (threads, models, renders) is disposable; 24h matches the old Redis TTLs. */
const WORKING_TTL_MS = 24 * 60 * 60 * 1000;

const RepairedSourceSchema = z.object({
  source: z.string().describe('The complete corrected diagram, from @startuml to @enduml'),
});

/** Filesystem- and URL-safe form of a caller-supplied id. */
export function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64) || 'session';
}

/** `components[2].provides[0]` → `components`. */
function sliceOfIssue(issue: IntegrityIssue): CsmSlice | null {
  const head = issue.path.split(/[.[]/)[0];
  return head && head in emptyCsm() ? (head as CsmSlice) : null;
}

export class Pipeline {
  private usage: RunUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, llmCalls: 0 };

  constructor(
    private readonly sessionId: string,
    private readonly version: number,
  ) {}

  /** Runs an LLM call, accumulates its usage, and files its trajectory for RL export. */
  async call<T>(
    step: string,
    options: Parameters<typeof callStructured<T>>[0],
    diagramType: string | null = null,
  ): Promise<T> {
    const result: StructuredCallResult<T> = await callStructured<T>({ captureReasoning: true, ...options });

    this.usage.promptTokens += result.usage.promptTokens;
    this.usage.completionTokens += result.usage.completionTokens;
    this.usage.totalTokens += result.usage.totalTokens;
    this.usage.llmCalls += 1;

    // Recorded even if the turn later fails: a trajectory that produced a bad
    // diagram is exactly the negative example the trainer wants.
    await Trajectory.create({
      sessionId: this.sessionId,
      version: this.version,
      step,
      diagramType,
      model: result.model,
      messages: result.messages,
      completion: result.raw,
      reasoning: result.reasoning,
      usage: result.usage,
      durationMs: result.durationMs,
      attempts: result.attempts,
    });

    return result.value;
  }

  totals(): RunUsage {
    return { ...this.usage };
  }
}

/** Fills the named slices from scratch, repairing integrity violations in place. */
async function* fillSlices(
  pipeline: Pipeline,
  csm: Csm,
  names: SliceName[],
  ctx: { brief: string; requirements: string; specs: DiagramSpec[] },
): AsyncGenerator<RunEvent, Csm> {
  let next = csm;

  for (const name of names) {
    const def = SLICES[name];
    yield { type: 'phase', phase: 'csm', detail: name };

    const guidance = ctx.specs
      .filter((spec) => spec.requiredSlices.some((slice) => def.writes.includes(slice)))
      .map((spec) => spec.sliceGuidance)
      .join('\n');

    const value = await pipeline.call<Partial<Csm>>(`csm_${name}`, {
      schema: def.schema,
      schemaName: `csm_${name}`,
      system: ARCHITECT_SYSTEM,
      user: sliceUserPrompt({
        instruction: def.instruction,
        brief: ctx.brief,
        requirements: ctx.requirements,
        digest: csmDigest(next),
        guidance: guidance || undefined,
      }),
      // Not 'high' on core: reasoning tokens come out of the same completion cap
      // the JSON needs, and at 8k TPM that trade truncates the document.
      effort: 'medium',
      maxTokens: def.maxTokens,
    });

    next = mergeSlice(next, value);
  }

  return next;
}

/**
 * Re-calls offending slices with their violations attached.
 *
 * Only slices that actually produced errors are re-called: a dangling id in
 * `flows` says nothing about `entities`, and rewriting a clean slice risks
 * churning ids that other slices already reference.
 */
async function* repairIntegrity(
  pipeline: Pipeline,
  csm: Csm,
  ctx: { brief: string; requirements: string; specs: DiagramSpec[] },
): AsyncGenerator<RunEvent, { csm: Csm; report: ReturnType<typeof validateCsm> }> {
  let next = csm;
  let report = validateCsm(next);

  for (let attempt = 0; attempt < env().MAX_CSM_REPAIR_ATTEMPTS && !report.ok; attempt += 1) {
    const bySlice = new Map<SliceName, IntegrityIssue[]>();
    for (const issue of report.errors) {
      const slice = sliceOfIssue(issue);
      if (!slice) continue;
      const name = sliceFor(slice);
      bySlice.set(name, [...(bySlice.get(name) ?? []), issue]);
    }
    if (bySlice.size === 0) break;

    for (const [name, issues] of bySlice) {
      const def = SLICES[name];
      yield { type: 'phase', phase: 'repair-csm', detail: name };

      const value = await pipeline.call<Partial<Csm>>(`repair_${name}`, {
        schema: def.schema,
        schemaName: `csm_${name}`,
        system: ARCHITECT_SYSTEM,
        user: sliceUserPrompt({
          instruction: def.instruction,
          brief: ctx.brief,
          requirements: ctx.requirements,
          digest: csmDigest(next),
          violations: formatIssues(issues),
        }),
        effort: 'medium',
        maxTokens: def.maxTokens,
      });

      next = mergeSlice(next, value);
    }

    report = validateCsm(next);
  }

  return { csm: next, report };
}

/** Projects, lints, repairs and renders one diagram. Yields the source before the render starts. */
async function* renderDiagram(
  pipeline: Pipeline,
  csm: Csm,
  spec: DiagramSpec,
  ctx: { sessionId: string; version: number; name: string },
): AsyncGenerator<RunEvent, DiagramPayload> {
  let source = spec.project(csm, {});
  let repairAttempts = 0;

  // Emitted immediately: the browser can show and highlight the source while
  // the JVM is still starting.
  yield {
    type: 'diagram',
    diagram: {
      type: spec.id,
      name: ctx.name,
      status: 'projected',
      source,
      svg: null,
      pngUrl: null,
      valid: null,
      errors: [],
      repairAttempts: 0,
      carriedForward: false,
      diagramId: null,
    },
  };

  let result = await validate(source, { bannedKeywords: spec.bannedKeywords });

  while (!result.valid && repairAttempts < env().MAX_REPAIR_ATTEMPTS) {
    repairAttempts += 1;
    yield { type: 'phase', phase: 'repair-diagram', detail: spec.id };

    // Deterministic fixes first — a stray code fence or a missing @enduml costs
    // nothing to correct and does not need the model.
    const fixed = autoFix(source);
    if (fixed.applied.length > 0 && fixed.source !== source) {
      source = fixed.source;
    } else {
      const repaired = await pipeline.call<z.infer<typeof RepairedSourceSchema>>(
        `repair_diagram_${spec.id}`,
        {
          schema: RepairedSourceSchema,
          schemaName: 'repaired_source',
          system: PLANTUML_REPAIR_SYSTEM,
          user: plantumlRepairPrompt({
            diagramType: spec.id,
            source,
            errors: result.errors.map((e) => (e.line ? `line ${e.line}: ${e.message}` : e.message)).join('\n'),
          }),
          role: 'fast',
          effort: 'low',
          maxTokens: 4000,
        },
        spec.id,
      );
      source = autoFix(repaired.source).source;
    }

    result = await validate(source, { bannedKeywords: spec.bannedKeywords });
  }

  const payload: DiagramPayload = {
    type: spec.id,
    name: ctx.name,
    status: 'rendered',
    source,
    svg: null,
    pngUrl: null,
    valid: result.valid,
    errors: result.errors,
    repairAttempts,
    carriedForward: false,
    diagramId: null,
  };

  if (result.valid) {
    const dir = safeSegment(ctx.sessionId);
    const file = `v${ctx.version}-${spec.id}.png`;
    const outPath = path.join(env().outputRoot, dir, file);
    const [rendered, svg] = await Promise.all([render(source, outPath), renderSvg(source)]);
    payload.svg = svg;
    payload.pngUrl = `/api/diagram/${dir}/${file}`;

    // Upsert, not insert: switching to a view twice within one version must
    // replace that render, not leave two documents claiming to be it.
    const doc = await Diagram.findOneAndUpdate(
      { sessionId: ctx.sessionId, version: ctx.version, type: spec.id },
      {
        $set: {
          source,
          svg,
          pngPath: rendered.pngPath,
          pngBytes: rendered.bytes,
          valid: true,
          renderErrors: [],
          repairAttempts,
          carriedForward: false,
          expiresAt: new Date(Date.now() + WORKING_TTL_MS),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    payload.diagramId = String(doc!._id);
  } else {
    const doc = await Diagram.findOneAndUpdate(
      { sessionId: ctx.sessionId, version: ctx.version, type: spec.id },
      {
        $set: {
          source,
          svg: null,
          pngPath: null,
          valid: false,
          renderErrors: result.errors,
          repairAttempts,
          carriedForward: false,
          expiresAt: new Date(Date.now() + WORKING_TTL_MS),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    payload.diagramId = String(doc!._id);
  }

  yield { type: 'diagram', diagram: payload };
  return payload;
}

export async function* runTurn(input: TurnInput): AsyncGenerator<RunEvent, void> {
  const startedAt = Date.now();
  const { sessionId } = input;

  const thread = await Thread.findOne({ sessionId });
  const mode: 'generate' | 'revise' = thread ? 'revise' : 'generate';
  const version = (thread?.currentVersion ?? 0) + 1;
  const pipeline = new Pipeline(sessionId, version);

  const requested =
    input.diagramTypes && input.diagramTypes.length > 0
      ? input.diagramTypes
      : (thread?.diagramTypes?.length ? thread.diagramTypes : DEFAULT_DIAGRAM_TYPES);
  const { resolved, unknown } = resolveDiagramTypes(requested);

  if (resolved.length === 0) {
    yield {
      type: 'error',
      message: `None of the requested diagram types are recognised: ${unknown.join(', ')}`,
      kind: 'bad-request',
    };
    return;
  }

  const specs = resolved.map((id) => DIAGRAM_SPECS[id]!);
  const brief = thread?.brief ?? input.prompt;

  let csm: Csm;
  let rationale: string | null = null;
  let changedSlices = new Set<CsmSlice>();
  let requirements = '';

  if (mode === 'generate') {
    yield { type: 'phase', phase: 'requirements', detail: null };
    const req = await pipeline.call<z.infer<typeof RequirementModelSchema>>('requirements', {
      schema: RequirementModelSchema,
      schemaName: 'requirement_model',
      system: REQUIREMENTS_SYSTEM,
      user: input.prompt,
      effort: 'medium',
      maxTokens: 5500,
    });
    requirements = requirementDigest(req);

    const needed: SliceName[] = ['core', ...slicesFor(specs.flatMap((s) => s.requiredSlices))];
    csm = yield* fillSlices(pipeline, emptyCsm(), needed, { brief, requirements, specs });
    changedSlices = new Set<CsmSlice>(needed.flatMap((n) => SLICES[n].writes));
  } else {
    const previous = await CsmVersion.findOne({ sessionId }).sort({ version: -1 });
    if (!previous) {
      yield { type: 'error', message: `Session ${sessionId} has no stored model to revise`, kind: 'not-found' };
      return;
    }
    csm = previous.csm as Csm;

    yield { type: 'phase', phase: 'plan', detail: null };
    const plan = await pipeline.call<z.infer<typeof RevisionPlanSchema>>('revision_plan', {
      schema: RevisionPlanSchema,
      schemaName: 'revision_plan',
      system: REVISION_SYSTEM,
      user: revisionPlanPrompt({ brief, instruction: input.prompt, digest: csmDigest(csm) }),
      effort: 'medium',
      maxTokens: 1200,
    });
    rationale = plan.rationale;

    // A revision may also ask for a diagram type this thread has never rendered;
    // its slices are empty, so they are generated rather than patched.
    const empty = new Set<SliceName>(
      specs.flatMap((spec) => missingSlices(csm, spec)).map((slice) => sliceFor(slice)),
    );
    const targets = [...new Set<SliceName>([...plan.slices, ...empty])];

    for (const name of targets) {
      const def = SLICES[name];

      if (empty.has(name)) {
        yield { type: 'phase', phase: 'csm', detail: name };
        const value = await pipeline.call<Partial<Csm>>(`csm_${name}`, {
          schema: def.schema,
          schemaName: `csm_${name}`,
          system: ARCHITECT_SYSTEM,
          user: sliceUserPrompt({
            instruction: def.instruction,
            brief,
            requirements: `The system already exists:\n${csmDigest(csm)}\n\nLatest instruction: ${input.prompt}`,
            digest: csmDigest(csm),
            guidance: specs
              .filter((spec) => spec.requiredSlices.some((slice) => def.writes.includes(slice)))
              .map((spec) => spec.sliceGuidance)
              .join('\n') || undefined,
          }),
          effort: 'medium',
          maxTokens: def.maxTokens,
        });
        csm = mergeSlice(csm, value);
        for (const slice of def.writes) changedSlices.add(slice);
        continue;
      }

      yield { type: 'phase', phase: 'patch', detail: name };
      const value = await pipeline.call<unknown>(`patch_${name}`, {
        schema: SLICE_PATCH_SCHEMAS[name],
        schemaName: `patch_${name}`,
        system: REVISION_SYSTEM,
        user: slicePatchPrompt({
          instruction: `${SLICE_PATCH_INSTRUCTIONS[name]}\n\nThe rules the slice must still satisfy:\n${def.instruction}`,
          brief,
          revision: input.prompt,
          rationale: plan.rationale,
          digest: csmDigest(csm),
          current: sliceContent(csm, def.writes as readonly (keyof Csm)[]),
        }),
        effort: 'medium',
        maxTokens: def.maxTokens,
      });

      const applied = applyPatch(csm, toCsmPatch(name, value, plan.rationale));
      csm = applied.csm;
      for (const slice of applied.changedSlices) changedSlices.add(slice);
    }
  }

  // On a revision there is no requirement model from this turn, so the repair
  // prompt is grounded in the model being repaired instead of an empty section.
  const repaired = yield* repairIntegrity(pipeline, csm, {
    brief,
    requirements: requirements || `The system already exists:\n${csmDigest(csm)}`,
    specs,
  });
  csm = repaired.csm;

  const expiresAt = new Date(Date.now() + WORKING_TTL_MS);
  await CsmVersion.create({
    sessionId,
    version,
    csm,
    rationale,
    integrity: { ok: repaired.report.ok, errors: repaired.report.errors, warnings: repaired.report.warnings },
    expiresAt,
  });

  yield { type: 'phase', phase: 'render', detail: null };

  for (const spec of specs) {
    const name = spec.id;
    const touched = mode === 'generate' || spec.requiredSlices.some((slice) => changedSlices.has(slice));

    if (!touched) {
      // Nothing this diagram depends on moved. Re-rendering it would produce a
      // byte-identical image and cost a JVM, so the previous render is reused.
      const prior = await Diagram.findOne({ sessionId, type: spec.id, valid: true }).sort({ version: -1 });
      if (prior) {
        const copy = await Diagram.findOneAndUpdate(
          { sessionId, version, type: spec.id },
          {
            $set: {
              source: prior.source,
              svg: prior.svg,
              pngPath: prior.pngPath,
              pngBytes: prior.pngBytes,
              valid: true,
              renderErrors: [],
              repairAttempts: 0,
              carriedForward: true,
              expiresAt,
            },
          },
          { upsert: true, returnDocument: 'after' },
        );
        yield {
          type: 'diagram',
          diagram: {
            type: spec.id,
            name,
            status: 'rendered',
            source: prior.source,
            svg: prior.svg ?? null,
            pngUrl: prior.pngPath
              ? `/api/diagram/${safeSegment(sessionId)}/${path.basename(prior.pngPath)}`
              : null,
            valid: true,
            errors: [],
            repairAttempts: 0,
            carriedForward: true,
            diagramId: String(copy!._id),
          },
        };
        continue;
      }
    }

    yield* renderDiagram(pipeline, csm, spec, { sessionId, version, name });
  }

  const userId = input.userId || 'anonymous';
  await Thread.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        brief,
        diagramTypes: resolved,
        currentVersion: version,
        expiresAt,
        userId,
      },
      $setOnInsert: { sessionId },
      $push: {
        turns: { version, prompt: input.prompt, kind: mode, diagramTypes: resolved, at: new Date() },
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  yield {
    type: 'done',
    sessionId,
    version,
    mode,
    diagramTypes: resolved,
    unknownTypes: unknown,
    changedSlices: [...changedSlices],
    rationale,
    integrity: {
      ok: repaired.report.ok,
      errors: repaired.report.errors,
      warnings: repaired.report.warnings,
    },
    usage: pipeline.totals(),
    ms: Date.now() - startedAt,
  };
}

export interface SwitchViewResult {
  version: number;
  diagram: DiagramPayload;
  /** 0 when the stored model already covered this view — the point of the canonical model. */
  llmCalls: number;
  usage: RunUsage;
  ms: number;
}

/**
 * Renders a diagram type the caller has not asked for before, from the model
 * already stored for the session.
 *
 * When the required slices are already populated this costs no LLM call at all
 * — the same design, projected through a different function. When they are not
 * (nobody asked for a state machine, so no lifecycle was ever modelled) the
 * missing slice is filled and folded back into the *same* version: enriching a
 * design is not revising it, so the version number does not move and no other
 * diagram is invalidated.
 */
export async function runSwitchView(input: {
  sessionId: string;
  diagramType: string;
}): Promise<SwitchViewResult> {
  const startedAt = Date.now();
  const { sessionId } = input;

  const { resolved, unknown } = resolveDiagramTypes([input.diagramType]);
  if (resolved.length === 0) {
    throw badRequest(`Unknown diagram type: ${unknown.join(', ')}`, {
      known: Object.keys(DIAGRAM_SPECS),
    });
  }
  const spec = DIAGRAM_SPECS[resolved[0]!]!;

  const stored = await CsmVersion.findOne({ sessionId }).sort({ version: -1 });
  if (!stored) {
    throw notFound(`No model found for session ${sessionId}. Generate diagrams first.`);
  }

  const thread = await Thread.findOne({ sessionId });
  const version = stored.version;
  const pipeline = new Pipeline(sessionId, version);
  let csm = stored.csm as Csm;

  const missing = [...new Set(missingSlices(csm, spec).map((slice) => sliceFor(slice)))];
  for (const name of missing) {
    const def = SLICES[name];
    const value = await pipeline.call<Partial<Csm>>(`csm_${name}`, {
      schema: def.schema,
      schemaName: `csm_${name}`,
      system: ARCHITECT_SYSTEM,
      user: sliceUserPrompt({
        instruction: def.instruction,
        brief: thread?.brief ?? csm.meta.oneLiner,
        requirements: `The system already exists. Extend it without contradicting it:\n${csmDigest(csm)}`,
        digest: csmDigest(csm),
        guidance: spec.sliceGuidance,
      }),
      effort: 'medium',
      maxTokens: def.maxTokens,
    });
    csm = mergeSlice(csm, value);
  }

  if (missing.length > 0) {
    const report = validateCsm(csm);
    stored.csm = csm;
    stored.integrity = { ok: report.ok, errors: report.errors, warnings: report.warnings };
    await stored.save();
  }

  // Drain the render generator; its intermediate events have no consumer here.
  const gen = renderDiagram(pipeline, csm, spec, { sessionId, version, name: spec.id });
  let step = await gen.next();
  while (!step.done) step = await gen.next();

  return {
    version,
    diagram: step.value,
    llmCalls: pipeline.totals().llmCalls,
    usage: pipeline.totals(),
    ms: Date.now() - startedAt,
  };
}
