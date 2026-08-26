import { UML_DIAGRAM_MODELS } from '../data/umlDiagrams.js';
import { projectActivity } from '../projectors/activity.js';
import { projectClass } from '../projectors/classDiagram.js';
import { projectCommunication } from '../projectors/communication.js';
import { projectComponent } from '../projectors/component.js';
import { projectCompositeStructure } from '../projectors/compositeStructure.js';
import { projectDeployment } from '../projectors/deployment.js';
import { projectInteractionOverview } from '../projectors/interactionOverview.js';
import { projectObject } from '../projectors/object.js';
import { projectPackage } from '../projectors/packageDiagram.js';
import { projectProfile } from '../projectors/profile.js';
import { projectSequence } from '../projectors/sequence.js';
import { projectStateMachine } from '../projectors/stateMachine.js';
import { projectTiming } from '../projectors/timing.js';
import { projectUseCase } from '../projectors/useCase.js';
import type { Projector } from '../projectors/types.js';
import type { Csm, CsmSlice } from './schemas/csm.js';

export interface DiagramSpec {
  /** Canonical id — matches an entry in UML_DIAGRAM_MODELS. */
  id: string;
  /** Accepted user-facing spellings, all lower-cased. */
  aliases: string[];
  /** CSM slices that must be populated for this diagram to say anything. */
  requiredSlices: CsmSlice[];
  /** Pure CSM → PlantUML transform. */
  project: Projector;
  /**
   * Keywords that must not appear in this diagram's source. A state diagram
   * containing `participant` parses fine but is the wrong diagram — the kind of
   * error only a per-type check catches.
   */
  bannedKeywords: string[];
  /** Guidance handed to the model when it is asked to fill this slice. */
  sliceGuidance: string;
}

/**
 * How full a slice must be before we consider it usable. A single component is
 * not a component diagram; a single flow step is not a sequence.
 */
const MIN_SLICE_SIZE: Partial<Record<CsmSlice, number>> = {
  components: 2,
  entities: 2,
  useCases: 2,
  actors: 1,
};

export const DIAGRAM_SPECS: Record<string, DiagramSpec> = {
  sequence: {
    id: 'sequence',
    aliases: ['sequence', 'sequential', 'seq', 'sequence-diagram', 'sequencediagram'],
    requiredSlices: ['flows'],
    project: projectSequence,
    bannedKeywords: ['usecase', '@startmindmap'],
    sliceGuidance:
      'Populate flows[]: each flow is one end-to-end scenario with ordered steps between actors and components. ' +
      'Every id used in a step must also appear in that flow\'s participants[].',
  },
  communication: {
    id: 'communication',
    aliases: ['communication', 'collaboration', 'comm'],
    requiredSlices: ['flows'],
    project: projectCommunication,
    bannedKeywords: ['usecase'],
    sliceGuidance: 'Populate flows[] — the same interactions a sequence diagram would show.',
  },
  class: {
    id: 'class',
    aliases: ['class', 'classes', 'class-diagram', 'domain', 'domain-model'],
    requiredSlices: ['entities'],
    project: projectClass,
    bannedKeywords: ['participant', 'usecase'],
    sliceGuidance:
      'Populate entities[]: the persistent nouns of the domain, their attributes with types, ' +
      'and relations to other entities. Mark regulated or personal fields with pii: true.',
  },
  object: {
    id: 'object',
    aliases: ['object', 'instance', 'snapshot'],
    requiredSlices: ['entities'],
    project: projectObject,
    bannedKeywords: ['participant', 'usecase'],
    sliceGuidance: 'Populate entities[] — instances are synthesised from the entity definitions.',
  },
  component: {
    id: 'component',
    aliases: ['component', 'components', 'comp', 'component-diagram', 'service', 'services'],
    requiredSlices: ['components'],
    project: projectComponent,
    bannedKeywords: ['participant', 'usecase'],
    sliceGuidance:
      'Populate components[] and interfaces[]: the services/modules, what each is responsible for, ' +
      'and the interfaces each provides and requires. Every provides[]/requires[] entry must name a real interface id.',
  },
  'composite-structure': {
    id: 'composite-structure',
    aliases: ['composite-structure', 'composite', 'internal-structure', 'compositestructure'],
    requiredSlices: ['components'],
    project: projectCompositeStructure,
    bannedKeywords: ['usecase'],
    sliceGuidance: 'Populate components[] with detailed responsibilities — these become the internal parts.',
  },
  deployment: {
    id: 'deployment',
    aliases: ['deployment', 'deploy', 'infrastructure', 'infra', 'topology'],
    requiredSlices: ['deployment'],
    project: projectDeployment,
    bannedKeywords: ['participant', 'usecase'],
    sliceGuidance:
      'Populate deployment.nodes[] (VMs, containers, cloud services), deployment.artifacts[] ' +
      '(deployable units mapped to component ids) and deployment.placements[] linking them.',
  },
  package: {
    id: 'package',
    aliases: ['package', 'packages', 'layering', 'modules'],
    requiredSlices: ['packages'],
    project: projectPackage,
    bannedKeywords: ['participant', 'usecase'],
    sliceGuidance: 'Populate packages[]: logical layers/namespaces, which components they contain, and their dependencies.',
  },
  profile: {
    id: 'profile',
    aliases: ['profile', 'stereotypes'],
    requiredSlices: ['components'],
    project: projectProfile,
    bannedKeywords: ['participant'],
    sliceGuidance: 'Populate components[] and nfrs[] — the profile is derived from the kinds and constraints in use.',
  },
  'use-case': {
    id: 'use-case',
    aliases: ['use-case', 'usecase', 'use case', 'usecases', 'use-cases'],
    requiredSlices: ['useCases', 'actors'],
    project: projectUseCase,
    bannedKeywords: ['participant'],
    sliceGuidance:
      'Populate actors[] and useCases[]: each use case is a goal an actor wants to achieve, ' +
      'with actorIds referencing real actor ids.',
  },
  activity: {
    id: 'activity',
    aliases: ['activity', 'workflow', 'process', 'flowchart'],
    requiredSlices: ['processes'],
    project: projectActivity,
    bannedKeywords: ['participant', 'usecase'],
    sliceGuidance:
      'Populate processes[]: exactly one start activity, at least one end, decisions with guarded outgoing ' +
      'transitions, and balanced fork/join pairs. Every activity must be reachable from start.',
  },
  'state-machine': {
    id: 'state-machine',
    aliases: ['state-machine', 'state', 'statechart', 'statemachine', 'lifecycle', 'states'],
    requiredSlices: ['stateMachines'],
    project: projectStateMachine,
    bannedKeywords: ['participant', 'usecase'],
    sliceGuidance:
      'Populate stateMachines[]: the lifecycle of a key entity, with exactly one transition from "[*]" ' +
      'and at least one transition to "[*]".',
  },
  'interaction-overview': {
    id: 'interaction-overview',
    aliases: ['interaction-overview', 'interaction', 'overview', 'storyboard'],
    requiredSlices: ['flows'],
    project: projectInteractionOverview,
    bannedKeywords: ['usecase'],
    sliceGuidance: 'Populate flows[] — the overview stitches them into a storyboard.',
  },
  timing: {
    id: 'timing',
    aliases: ['timing', 'time', 'sla', 'latency'],
    requiredSlices: ['timings'],
    project: projectTiming,
    bannedKeywords: ['participant', 'usecase'],
    sliceGuidance:
      'Populate timings[]: for a latency-sensitive subject, an ordered timeline of states with relative ' +
      'time labels (e.g. "0ms", "T+2s") and the SLA budgets that apply.',
  },
};

/** Every registry entry must correspond to a catalogued diagram type, and vice versa. */
const CATALOG_IDS = new Set(UML_DIAGRAM_MODELS.map((m) => m.id));
for (const id of Object.keys(DIAGRAM_SPECS)) {
  if (!CATALOG_IDS.has(id)) {
    throw new Error(`DIAGRAM_SPECS has "${id}" which is missing from UML_DIAGRAM_MODELS`);
  }
}
for (const id of CATALOG_IDS) {
  if (!DIAGRAM_SPECS[id]) {
    throw new Error(`UML_DIAGRAM_MODELS has "${id}" which is missing from DIAGRAM_SPECS`);
  }
}

export function getSpec(id: string): DiagramSpec | undefined {
  return DIAGRAM_SPECS[id];
}

/** How many entries a CSM slice currently holds. */
export function sliceSize(csm: Csm, slice: CsmSlice): number {
  switch (slice) {
    case 'meta':
      return csm.meta.name ? 1 : 0;
    case 'deployment':
      return csm.deployment.nodes.length;
    default:
      return (csm[slice] as unknown[]).length;
  }
}

/** Slices this diagram needs that the CSM does not yet adequately populate. */
export function missingSlices(csm: Csm, spec: DiagramSpec): CsmSlice[] {
  return spec.requiredSlices.filter((slice) => sliceSize(csm, slice) < (MIN_SLICE_SIZE[slice] ?? 1));
}
