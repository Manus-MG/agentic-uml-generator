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
  type Csm,
  type CsmSlice,
} from './csm.js';

/**
 * A revision patch against an existing CSM.
 *
 * Turn 2+ does not rebuild the model from scratch: that would churn every id,
 * invalidate every diagram, and lose the user's earlier intent. Instead the
 * model emits only what changed, we apply it, and only the diagrams whose
 * slices were touched get re-projected.
 *
 * Shape note: an id-keyed map would be the natural encoding, but Groq's strict
 * decoder does not support `patternProperties`, so changes are expressed as
 * whole replacement elements in `upsert` (matched by `id`) plus `remove` id
 * lists. Upsert-by-id is also idempotent, which makes replaying a patch safe.
 */
export const CsmPatchSchema = z.object({
  rationale: z.string().describe('One paragraph: what changed in the design and why'),
  meta: MetaSchema.nullable().describe('Non-null only if the system summary itself changed'),

  upsert: z.object({
    actors: z.array(ActorSchema),
    components: z.array(ComponentSchema),
    interfaces: z.array(InterfaceSchema),
    entities: z.array(EntitySchema),
    useCases: z.array(UseCaseSchema),
    flows: z.array(FlowSchema),
    processes: z.array(ProcessSchema),
    stateMachines: z.array(StateMachineSchema),
    packages: z.array(PackageSchema),
    timings: z.array(TimingSchema),
    nfrs: z.array(NfrSchema),
    deployment: DeploymentSchema.nullable().describe('Non-null replaces the whole deployment slice'),
  }),

  remove: z.object({
    actors: z.array(z.string()),
    components: z.array(z.string()),
    interfaces: z.array(z.string()),
    entities: z.array(z.string()),
    useCases: z.array(z.string()),
    flows: z.array(z.string()),
    processes: z.array(z.string()),
    stateMachines: z.array(z.string()),
    packages: z.array(z.string()),
  }),
});

export type CsmPatch = z.infer<typeof CsmPatchSchema>;

/** Collections addressed by id in a patch. `timings`/`nfrs` have no id, so they replace wholesale. */
const ID_COLLECTIONS = [
  'actors',
  'components',
  'interfaces',
  'entities',
  'useCases',
  'flows',
  'processes',
  'stateMachines',
  'packages',
] as const;

type IdCollection = (typeof ID_COLLECTIONS)[number];

export interface PatchResult {
  csm: Csm;
  /** Slices actually altered — drives selective diagram regeneration. */
  changedSlices: Set<CsmSlice>;
  /** Element ids added, replaced or deleted, for the run report. */
  touchedIds: string[];
}

function upsertById<T extends { id: string }>(existing: T[], incoming: T[]): { next: T[]; touched: string[] } {
  if (incoming.length === 0) return { next: existing, touched: [] };
  const byId = new Map(existing.map((e) => [e.id, e]));
  for (const item of incoming) byId.set(item.id, item);
  return { next: [...byId.values()], touched: incoming.map((i) => i.id) };
}

/**
 * Applies a patch to a CSM, returning a new model plus the set of slices that
 * changed. Never mutates the input: CSM versions are the audit trail, and a
 * mutated prior version would destroy the ability to diff revisions.
 */
export function applyPatch(base: Csm, patch: CsmPatch): PatchResult {
  const csm: Csm = structuredClone(base);
  const changedSlices = new Set<CsmSlice>();
  const touchedIds: string[] = [];

  if (patch.meta) {
    csm.meta = patch.meta;
    changedSlices.add('meta');
  }

  for (const key of ID_COLLECTIONS) {
    const incoming = patch.upsert[key] as { id: string }[];
    const removeIds = new Set(patch.remove[key]);

    let list = csm[key] as { id: string }[];
    let changed = false;

    if (removeIds.size > 0) {
      const before = list.length;
      list = list.filter((e) => !removeIds.has(e.id));
      if (list.length !== before) {
        changed = true;
        touchedIds.push(...removeIds);
      }
    }

    const { next, touched } = upsertById(list, incoming as never[]);
    if (touched.length > 0) {
      changed = true;
      touchedIds.push(...touched);
    }

    if (changed) {
      (csm[key] as unknown) = next;
      changedSlices.add(key as CsmSlice);
    }
  }

  if (patch.upsert.deployment) {
    csm.deployment = patch.upsert.deployment;
    changedSlices.add('deployment');
    touchedIds.push(...patch.upsert.deployment.nodes.map((n) => n.id));
  }

  if (patch.upsert.timings.length > 0) {
    csm.timings = patch.upsert.timings;
    changedSlices.add('timings');
  }

  if (patch.upsert.nfrs.length > 0) {
    csm.nfrs = patch.upsert.nfrs;
    changedSlices.add('nfrs');
  }

  return { csm, changedSlices, touchedIds: [...new Set(touchedIds)] };
}

/** An empty patch — used as the "nothing changed" baseline in tests and no-op turns. */
export function emptyPatch(): CsmPatch {
  return {
    rationale: '',
    meta: null,
    upsert: {
      actors: [], components: [], interfaces: [], entities: [], useCases: [],
      flows: [], processes: [], stateMachines: [], packages: [], timings: [],
      nfrs: [], deployment: null,
    },
    remove: {
      actors: [], components: [], interfaces: [], entities: [], useCases: [],
      flows: [], processes: [], stateMachines: [], packages: [],
    },
  };
}
