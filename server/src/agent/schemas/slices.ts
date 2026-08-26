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
 * The CSM is built one slice at a time rather than in a single call.
 *
 * The immediate reason is a hard limit: Groq counts `max_completion_tokens`
 * toward the per-minute token budget, and the free tier allows 8,000 TPM. The
 * whole-CSM schema alone is ~2,950 tokens, so one monolithic call cannot fit
 * alongside a useful completion budget — it returns a 413 before the model even
 * runs.
 *
 * It is also simply better. Each call sees a schema of 200-700 tokens and one
 * job, instead of a 3,000-token schema and thirteen. Constrained decoding is
 * more reliable on a small schema, the failure blast radius is one slice rather
 * than the entire model, and we only pay for the slices the requested diagrams
 * actually need.
 */
export const CoreSliceSchema = z.object({
  meta: MetaSchema,
  actors: z.array(ActorSchema),
  components: z.array(ComponentSchema),
  interfaces: z.array(InterfaceSchema),
});

export const EntitiesSliceSchema = z.object({ entities: z.array(EntitySchema) });
export const UseCasesSliceSchema = z.object({ useCases: z.array(UseCaseSchema) });
export const FlowsSliceSchema = z.object({ flows: z.array(FlowSchema) });
export const ProcessesSliceSchema = z.object({ processes: z.array(ProcessSchema) });
export const StateMachinesSliceSchema = z.object({ stateMachines: z.array(StateMachineSchema) });
export const DeploymentSliceSchema = z.object({ deployment: DeploymentSchema });
export const PackagesSliceSchema = z.object({ packages: z.array(PackageSchema) });
export const QualitiesSliceSchema = z.object({
  timings: z.array(TimingSchema),
  nfrs: z.array(NfrSchema),
});

export type SliceName =
  | 'core'
  | 'entities'
  | 'useCases'
  | 'flows'
  | 'processes'
  | 'stateMachines'
  | 'deployment'
  | 'packages'
  | 'qualities';

export interface SliceDefinition {
  name: SliceName;
  schema: z.ZodType<Partial<Csm>>;
  /** CSM collections this slice writes. */
  writes: CsmSlice[];
  /** Max completion tokens — sized to the slice, since it counts against TPM. */
  maxTokens: number;
  /** Task description handed to the model. */
  instruction: string;
}

export const SLICES: Record<SliceName, SliceDefinition> = {
  core: {
    name: 'core',
    schema: CoreSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['meta', 'actors', 'components', 'interfaces'],
    maxTokens: 5000,
    instruction:
      'Define the system skeleton: meta (name, one-liner, domain, assumptions, open questions), ' +
      'the actors that interact with it, the components that make it up, and the interfaces ' +
      'components expose to each other.\n' +
      'Rules:\n' +
      '- ids are lower-kebab-case and unique across BOTH actors and components\n' +
      '- every interface.providerId must name a component, and that component must list the ' +
      'interface id in its provides[]\n' +
      '- every id in a component\'s provides[]/requires[] must be a real interface id\n' +
      '- packageId must be null at this stage\n' +
      '- aim for 5-7 components: enough to be useful, few enough to read\n' +
      '- at most 3 responsibilities per component and 3 operations per interface, one line each',
  },
  entities: {
    name: 'entities',
    schema: EntitiesSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['entities'],
    maxTokens: 3000,
    instruction:
      'Define the persistent domain entities: the nouns the system stores. Give each realistic ' +
      'attributes with types, and relations to other entities.\n' +
      'Rules:\n' +
      '- every relation.toId must be another entity id in this same list\n' +
      '- "inherits" means "this entity is a kind of toId"\n' +
      '- set pii: true on any attribute holding personal or regulated data',
  },
  useCases: {
    name: 'useCases',
    schema: UseCasesSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['useCases'],
    maxTokens: 2000,
    instruction:
      'Define the use cases: goals actors want to achieve with the system.\n' +
      'Rules:\n' +
      '- every actorIds entry must be an existing actor id\n' +
      '- includes/extends must reference other use case ids in this same list, never itself',
  },
  flows: {
    name: 'flows',
    schema: FlowsSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['flows'],
    maxTokens: 4000,
    instruction:
      'Define the end-to-end interaction flows — the message exchanges a sequence diagram would show.\n' +
      'Rules:\n' +
      '- participants[] lists every actor/component id the flow touches, in the order they should ' +
      'appear as lifelines\n' +
      '- every step fromId/toId MUST already appear in that flow\'s participants[]\n' +
      '- kind: "sync" for a call, "async" for fire-and-forget, "return" for a response\n' +
      '- set group to "alt"/"loop"/"par" on consecutive steps that belong to one fragment, and give ' +
      'the first such step a condition; use null for ordinary steps\n' +
      '- produce 1-2 flows with 6-12 steps each',
  },
  processes: {
    name: 'processes',
    schema: ProcessesSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['processes'],
    maxTokens: 4000,
    instruction:
      'Define the business processes as activity graphs with swimlanes.\n' +
      'Rules (these are validated and a violation fails the build):\n' +
      '- EXACTLY ONE activity of type "start", and at least one of type "end"\n' +
      '- every activity must be reachable from start via transitions\n' +
      '- "decision" activities need 2+ outgoing transitions, each with a guard like "yes"/"no"\n' +
      '- every "fork" must have a matching "join" (equal counts), with branches converging on it\n' +
      '- laneId must reference a lane defined in the same process\n' +
      '- name the start/end activities "start"/"end"',
  },
  stateMachines: {
    name: 'stateMachines',
    schema: StateMachinesSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['stateMachines'],
    maxTokens: 3000,
    instruction:
      'Define the lifecycle of the most important entity or component as a state machine.\n' +
      'Rules:\n' +
      '- subjectId must be an existing entity or component id\n' +
      '- EXACTLY ONE transition whose fromId is the literal "[*]"\n' +
      '- at least one transition whose toId is the literal "[*]"\n' +
      '- every other fromId/toId must be a state id defined in the same machine\n' +
      '- every state must be reachable from the initial state',
  },
  deployment: {
    name: 'deployment',
    schema: DeploymentSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['deployment'],
    maxTokens: 3000,
    instruction:
      'Define the runtime topology: the nodes the system runs on, the deployable artifacts, and ' +
      'which artifact sits on which node.\n' +
      'Rules:\n' +
      '- artifact.componentIds must reference existing component ids\n' +
      '- every placement must reference a real artifact id and a real node id\n' +
      '- group related components into a small number of artifacts rather than one each',
  },
  packages: {
    name: 'packages',
    schema: PackagesSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['packages'],
    maxTokens: 2000,
    instruction:
      'Group the components into logical packages (layers or bounded contexts) and state the ' +
      'dependencies between packages.\n' +
      'Rules:\n' +
      '- containsComponentIds must reference existing component ids; cover every component exactly once\n' +
      '- dependsOn must reference other package ids, never itself\n' +
      '- keep dependencies acyclic',
  },
  qualities: {
    name: 'qualities',
    schema: QualitiesSliceSchema as unknown as z.ZodType<Partial<Csm>>,
    writes: ['timings', 'nfrs'],
    maxTokens: 2500,
    instruction:
      'Define the non-functional requirements and, for the most latency-sensitive subject, a timing ' +
      'profile.\n' +
      'Rules:\n' +
      '- timings[].subjectId must reference an existing entity, component, actor, flow or process id\n' +
      '- timeline entries use relative labels like "0ms", "900ms", "4s"\n' +
      '- give 3-5 nfrs across different categories',
  },
};

/** Which slice call produces a given CSM collection. */
const SLICE_FOR: Record<CsmSlice, SliceName> = {
  meta: 'core',
  actors: 'core',
  components: 'core',
  interfaces: 'core',
  entities: 'entities',
  useCases: 'useCases',
  flows: 'flows',
  processes: 'processes',
  stateMachines: 'stateMachines',
  deployment: 'deployment',
  packages: 'packages',
  timings: 'qualities',
  nfrs: 'qualities',
};

export function sliceFor(slice: CsmSlice): SliceName {
  return SLICE_FOR[slice];
}

/** Slice calls needed to satisfy the given CSM collections, `core` excluded (always run). */
export function slicesFor(required: CsmSlice[]): SliceName[] {
  const names = new Set<SliceName>();
  for (const slice of required) {
    const name = SLICE_FOR[slice];
    if (name !== 'core') names.add(name);
  }
  return [...names];
}

/** Merges a slice result into a CSM without mutating the input. */
export function mergeSlice(csm: Csm, partial: Partial<Csm>): Csm {
  return { ...structuredClone(csm), ...structuredClone(partial) };
}
