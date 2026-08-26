import { z } from 'zod';

/**
 * The Canonical System Model (CSM).
 *
 * This is the single source of truth for a thread. Every UML diagram we emit is
 * a pure projection of a slice of this object, which is what makes a Sequence
 * diagram and a Component diagram describe the *same* system rather than two
 * independently hallucinated ones.
 *
 * Groq's strict structured-output mode (constrained decoding) imposes three
 * rules on the JSON Schema we derive from this file:
 *
 *   1. every object must set `additionalProperties: false`
 *   2. every property must appear in `required`
 *   3. optionality is expressed as a union with `null`
 *
 * So: **never use `.optional()` in this file — use `.nullable()`.** Rule 3 is
 * the one that bites; an `.optional()` field silently drops out of `required`
 * and Groq then rejects the schema. `strictJsonSchema.ts` asserts all three at
 * runtime and a unit test walks this schema to fail the build if one slips in.
 */

const Id = z.string().min(1).describe('Stable slug-style identifier, unique within its collection');

export const ActorKind = z.enum(['human', 'external_system', 'scheduler']);
export const ComponentKind = z.enum(['service', 'ui', 'db', 'queue', 'job', 'external']);
export const RelationKind = z.enum(['one-to-one', 'one-to-many', 'many-to-many', 'inherits', 'composes']);
export const StepKind = z.enum(['sync', 'async', 'return']);
export const StepGroup = z.enum(['alt', 'loop', 'par']);
export const ActivityKind = z.enum(['action', 'decision', 'fork', 'join', 'start', 'end']);
export const NodeKind = z.enum(['device', 'vm', 'container', 'cloud-service']);

export const MetaSchema = z.object({
  name: z.string().describe('Short system name'),
  oneLiner: z.string().describe('One sentence describing what the system does'),
  domain: z.string().describe('Business domain, e.g. "regulatory compliance"'),
  assumptions: z.array(z.string()).describe('Assumptions made where the prompt was silent'),
  openQuestions: z.array(z.string()).describe('Ambiguities a human should resolve'),
});

export const ActorSchema = z.object({
  id: Id,
  name: z.string(),
  kind: ActorKind,
  goals: z.array(z.string()),
});

export const ComponentSchema = z.object({
  id: Id,
  name: z.string(),
  kind: ComponentKind,
  responsibilities: z.array(z.string()),
  provides: z.array(Id).describe('interface ids this component implements'),
  requires: z.array(Id).describe('interface ids this component consumes'),
  packageId: Id.nullable(),
});

export const OperationSchema = z.object({
  name: z.string(),
  input: z.string(),
  output: z.string(),
  sync: z.boolean(),
});

export const InterfaceSchema = z.object({
  id: Id,
  name: z.string(),
  providerId: Id.describe('component id that provides this interface'),
  operations: z.array(OperationSchema),
});

export const AttributeSchema = z.object({
  name: z.string(),
  type: z.string(),
  pii: z.boolean().describe('true when the attribute holds personally identifiable information'),
});

export const RelationSchema = z.object({
  toId: Id,
  kind: RelationKind,
  label: z.string().nullable(),
});

export const EntitySchema = z.object({
  id: Id,
  name: z.string(),
  attributes: z.array(AttributeSchema),
  relations: z.array(RelationSchema),
});

export const UseCaseSchema = z.object({
  id: Id,
  name: z.string(),
  actorIds: z.array(Id),
  includes: z.array(Id).describe('use case ids this one includes'),
  extends: z.array(Id).describe('use case ids this one extends'),
});

export const StepSchema = z.object({
  fromId: Id.describe('actor or component id'),
  toId: Id.describe('actor or component id'),
  message: z.string(),
  kind: StepKind,
  condition: z.string().nullable().describe('guard shown on alt/loop groups'),
  group: StepGroup.nullable().describe('non-null starts or continues a fragment'),
});

export const ErrorPathSchema = z.object({
  when: z.string(),
  handledBy: Id,
  action: z.string(),
});

export const FlowSchema = z.object({
  id: Id,
  name: z.string(),
  trigger: z.string(),
  participants: z.array(Id).describe('ordered actor/component ids appearing as lifelines'),
  steps: z.array(StepSchema),
  errorPaths: z.array(ErrorPathSchema),
});

export const ActivitySchema = z.object({
  id: Id,
  name: z.string(),
  laneId: Id.nullable(),
  type: ActivityKind,
});

export const TransitionSchema = z.object({
  fromId: Id,
  toId: Id,
  guard: z.string().nullable(),
});

export const LaneSchema = z.object({
  id: Id,
  name: z.string(),
});

export const ProcessSchema = z.object({
  id: Id,
  name: z.string(),
  lanes: z.array(LaneSchema),
  activities: z.array(ActivitySchema),
  transitions: z.array(TransitionSchema),
});

export const StateSchema = z.object({
  id: Id,
  name: z.string(),
  entry: z.string().nullable(),
  exit: z.string().nullable(),
});

export const StateTransitionSchema = z.object({
  fromId: Id.describe('state id, or the literal "[*]" for the initial pseudostate'),
  toId: Id.describe('state id, or the literal "[*]" for a terminal pseudostate'),
  event: z.string(),
  guard: z.string().nullable(),
  action: z.string().nullable(),
});

export const StateMachineSchema = z.object({
  id: Id,
  subjectId: Id.describe('entity or component id whose lifecycle this describes'),
  states: z.array(StateSchema),
  transitions: z.array(StateTransitionSchema),
});

export const DeploymentNodeSchema = z.object({
  id: Id,
  name: z.string(),
  kind: NodeKind,
  env: z.string().describe('e.g. "production", "aws-ap-south-1"'),
});

export const ArtifactSchema = z.object({
  id: Id,
  name: z.string(),
  componentIds: z.array(Id),
});

export const PlacementSchema = z.object({
  artifactId: Id,
  nodeId: Id,
});

export const DeploymentSchema = z.object({
  nodes: z.array(DeploymentNodeSchema),
  artifacts: z.array(ArtifactSchema),
  placements: z.array(PlacementSchema),
});

export const PackageSchema = z.object({
  id: Id,
  name: z.string(),
  containsComponentIds: z.array(Id),
  dependsOn: z.array(Id).describe('package ids'),
});

export const TimingPointSchema = z.object({
  at: z.string().describe('relative time label, e.g. "0ms", "T+2s"'),
  state: z.string(),
});

export const SlaSchema = z.object({
  name: z.string(),
  budgetMs: z.number(),
});

export const TimingSchema = z.object({
  subjectId: Id,
  timeline: z.array(TimingPointSchema),
  slas: z.array(SlaSchema),
});

export const NfrSchema = z.object({
  category: z.string().describe('e.g. security, performance, availability, compliance'),
  statement: z.string(),
});

export const CsmSchema = z.object({
  meta: MetaSchema,
  actors: z.array(ActorSchema),
  components: z.array(ComponentSchema),
  interfaces: z.array(InterfaceSchema),
  entities: z.array(EntitySchema),
  useCases: z.array(UseCaseSchema),
  flows: z.array(FlowSchema),
  processes: z.array(ProcessSchema),
  stateMachines: z.array(StateMachineSchema),
  deployment: DeploymentSchema,
  packages: z.array(PackageSchema),
  timings: z.array(TimingSchema),
  nfrs: z.array(NfrSchema),
});

export type Csm = z.infer<typeof CsmSchema>;
export type CsmActor = z.infer<typeof ActorSchema>;
export type CsmComponent = z.infer<typeof ComponentSchema>;
export type CsmInterface = z.infer<typeof InterfaceSchema>;
export type CsmEntity = z.infer<typeof EntitySchema>;
export type CsmUseCase = z.infer<typeof UseCaseSchema>;
export type CsmFlow = z.infer<typeof FlowSchema>;
export type CsmProcess = z.infer<typeof ProcessSchema>;
export type CsmStateMachine = z.infer<typeof StateMachineSchema>;
export type CsmDeployment = z.infer<typeof DeploymentSchema>;
export type CsmPackage = z.infer<typeof PackageSchema>;
export type CsmTiming = z.infer<typeof TimingSchema>;

/** The top-level CSM collections a diagram type can depend on. */
export const CSM_SLICES = [
  'meta',
  'actors',
  'components',
  'interfaces',
  'entities',
  'useCases',
  'flows',
  'processes',
  'stateMachines',
  'deployment',
  'packages',
  'timings',
  'nfrs',
] as const;

export type CsmSlice = (typeof CSM_SLICES)[number];

/** An empty but schema-valid CSM — the starting point for a fresh thread. */
export function emptyCsm(): Csm {
  return {
    meta: { name: '', oneLiner: '', domain: '', assumptions: [], openQuestions: [] },
    actors: [],
    components: [],
    interfaces: [],
    entities: [],
    useCases: [],
    flows: [],
    processes: [],
    stateMachines: [],
    deployment: { nodes: [], artifacts: [], placements: [] },
    packages: [],
    timings: [],
    nfrs: [],
  };
}
