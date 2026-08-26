import { z } from 'zod';
import {
  ActorSchema,
  ComponentSchema,
  DeploymentSchema,
  EntitySchema,
  FlowSchema,
  InterfaceSchema,
  MetaSchema,
  NfrSchema,
  PackageSchema,
  ProcessSchema,
  StateMachineSchema,
  TimingSchema,
  UseCaseSchema,
} from './csm.js';
import { emptyPatch, type CsmPatch } from './csmPatch.js';
import type { SliceName } from './slices.js';

/**
 * Revision patches, one slice at a time.
 *
 * `CsmPatchSchema` describes the ideal revision call — the whole model patched
 * in one shot — but it cannot be used on this account. Measured against the
 * strict-mode encoder it is ~3,680 schema tokens, and a mature CSM serialises
 * to ~3,700 more. Groq counts schema, prompt and `max_completion_tokens`
 * against the same per-minute budget (8,000 on the free tier), so a single
 * whole-model patch call is rejected before the model runs.
 *
 * The fix is the same one `slices.ts` applies to generation: patch one slice
 * per call, against a schema of 200-800 tokens. Each result is widened into a
 * full `CsmPatch` by `toCsmPatch` and applied with the existing `applyPatch`,
 * so upsert-by-id semantics, `changedSlices` and the no-mutation guarantee are
 * shared with the whole-model path rather than reimplemented.
 *
 * Patching, not regenerating, is the point: the model returns only the elements
 * that changed, so ids of untouched elements stay stable and diagrams that did
 * not need to move do not move.
 */

/** Which slices a revision needs to touch. Deliberately tiny — it runs first, on every revision. */
export const RevisionPlanSchema = z.object({
  rationale: z.string().describe('One paragraph: what changes in the design, and why'),
  slices: z
    .array(
      z.enum([
        'core',
        'entities',
        'useCases',
        'flows',
        'processes',
        'stateMachines',
        'deployment',
        'packages',
        'qualities',
      ]),
    )
    .describe('Only the slices that must change. Empty means the request needs no model change.'),
});

export type RevisionPlan = z.infer<typeof RevisionPlanSchema>;

const CorePatchSchema = z.object({
  meta: MetaSchema.nullable().describe('Non-null only if the system summary itself changed'),
  upsertActors: z.array(ActorSchema),
  upsertComponents: z.array(ComponentSchema),
  upsertInterfaces: z.array(InterfaceSchema),
  removeActorIds: z.array(z.string()),
  removeComponentIds: z.array(z.string()),
  removeInterfaceIds: z.array(z.string()),
});

/** `upsert` replaces or adds by id; `removeIds` deletes. Everything else is left alone. */
const idPatch = <T extends z.ZodTypeAny>(element: T) =>
  z.object({ upsert: z.array(element), removeIds: z.array(z.string()) });

const EntitiesPatchSchema = idPatch(EntitySchema);
const UseCasesPatchSchema = idPatch(UseCaseSchema);
const FlowsPatchSchema = idPatch(FlowSchema);
const ProcessesPatchSchema = idPatch(ProcessSchema);
const StateMachinesPatchSchema = idPatch(StateMachineSchema);
const PackagesPatchSchema = idPatch(PackageSchema);

/** Deployment has no stable element identity across a retopology, so it replaces wholesale. */
const DeploymentPatchSchema = z.object({ deployment: DeploymentSchema });

/** Timings and nfrs carry no ids, so they replace wholesale too. */
const QualitiesPatchSchema = z.object({
  timings: z.array(TimingSchema),
  nfrs: z.array(NfrSchema),
});

export const SLICE_PATCH_SCHEMAS: Record<SliceName, z.ZodType<unknown>> = {
  core: CorePatchSchema,
  entities: EntitiesPatchSchema,
  useCases: UseCasesPatchSchema,
  flows: FlowsPatchSchema,
  processes: ProcessesPatchSchema,
  stateMachines: StateMachinesPatchSchema,
  deployment: DeploymentPatchSchema,
  packages: PackagesPatchSchema,
  qualities: QualitiesPatchSchema,
};

/** What to tell the model to do for each slice patch, beyond the slice's own generation rules. */
export const SLICE_PATCH_INSTRUCTIONS: Record<SliceName, string> = {
  core: 'Return only actors, components and interfaces that are new or changed, and the ids of any to delete. Set meta only if the system summary itself changed.',
  entities: 'Return only entities that are new or changed, and the ids of any to delete.',
  useCases: 'Return only use cases that are new or changed, and the ids of any to delete.',
  flows: 'Return only flows that are new or changed, and the ids of any to delete. A changed flow must be returned complete, with all of its steps.',
  processes: 'Return only processes that are new or changed, and the ids of any to delete. A changed process must be returned complete, with all activities and transitions.',
  stateMachines: 'Return only state machines that are new or changed, and the ids of any to delete. A changed machine must be returned complete.',
  deployment: 'Return the complete deployment topology, revised. It replaces the current one wholesale.',
  packages: 'Return only packages that are new or changed, and the ids of any to delete.',
  qualities: 'Return the complete timings and nfrs, revised. They replace the current ones wholesale.',
};

/**
 * Widens one slice patch into a full `CsmPatch` so `applyPatch` can consume it.
 *
 * `rationale` is carried on the plan, not the slice, so it is passed in here.
 */
export function toCsmPatch(slice: SliceName, value: unknown, rationale: string): CsmPatch {
  const patch = emptyPatch();
  patch.rationale = rationale;

  switch (slice) {
    case 'core': {
      const v = value as z.infer<typeof CorePatchSchema>;
      patch.meta = v.meta;
      patch.upsert.actors = v.upsertActors;
      patch.upsert.components = v.upsertComponents;
      patch.upsert.interfaces = v.upsertInterfaces;
      patch.remove.actors = v.removeActorIds;
      patch.remove.components = v.removeComponentIds;
      patch.remove.interfaces = v.removeInterfaceIds;
      return patch;
    }
    case 'deployment': {
      patch.upsert.deployment = (value as z.infer<typeof DeploymentPatchSchema>).deployment;
      return patch;
    }
    case 'qualities': {
      const v = value as z.infer<typeof QualitiesPatchSchema>;
      patch.upsert.timings = v.timings;
      patch.upsert.nfrs = v.nfrs;
      return patch;
    }
    default: {
      const v = value as { upsert: { id: string }[]; removeIds: string[] };
      const key = slice as 'entities' | 'useCases' | 'flows' | 'processes' | 'stateMachines' | 'packages';
      (patch.upsert[key] as unknown) = v.upsert;
      patch.remove[key] = v.removeIds;
      return patch;
    }
  }
}
