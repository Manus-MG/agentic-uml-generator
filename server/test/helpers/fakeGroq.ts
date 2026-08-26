import type Groq from 'groq-sdk';
import { SEBI_CSM } from '../fixtures/sebiCsm.js';
import type { RequirementModel } from '../../src/agent/schemas/requirements.js';

/**
 * A stand-in for the Groq client.
 *
 * Route tests need the whole pipeline to run — slice by slice, in order, with
 * the real schemas validating every response — without spending tokens or
 * depending on a network. The fake answers by `schemaName`, returning the
 * matching slice of the SEBI fixture, so what comes back is a real, valid CSM
 * rather than a shape that merely parses.
 */
export const FAKE_REQUIREMENTS: RequirementModel = {
  systemName: 'SEBI Compliance Monitor',
  summary: 'Pulls SEBI circulars, parses them into clauses, and reports gaps and impact.',
  domain: 'regulatory compliance',
  goals: ['Track new circulars', 'Identify compliance gaps'],
  inScope: ['Circular ingestion', 'Gap analysis'],
  outOfScope: ['Filing submissions'],
  actors: [
    { name: 'Compliance Officer', kind: 'human', responsibility: 'Reviews findings' },
    { name: 'SEBI Portal', kind: 'external_system', responsibility: 'Publishes circulars' },
  ],
  externalSystems: [{ name: 'SEBI Portal', purpose: 'Source of circulars', integrationStyle: 'REST poll' }],
  functionalRequirements: [
    { id: 'fr-fetch', statement: 'Fetch the latest circulars', priority: 'must' },
    { id: 'fr-gap', statement: 'Compare clauses against the current control set', priority: 'must' },
  ],
  nonFunctionalRequirements: [{ category: 'auditability', statement: 'Every decision is traceable' }],
  dataObjects: [{ name: 'Circular', description: 'A published SEBI circular', sensitive: false }],
  keyProcesses: [
    { name: 'Ingest', trigger: 'daily schedule', outline: ['fetch', 'parse', 'store'] },
  ],
  assumptions: ['Circulars are available as HTML'],
  ambiguities: [{ question: 'Which control framework?', assumedAnswer: 'An internal control register' }],
  confidence: 0.8,
};

/** What the fake returns for each `schemaName` the pipeline asks for. */
function responseFor(schemaName: string): unknown {
  switch (schemaName) {
    case 'requirement_model':
      return FAKE_REQUIREMENTS;
    case 'csm_core':
      return {
        meta: SEBI_CSM.meta,
        actors: SEBI_CSM.actors,
        // The core slice is asked for packageId: null — packages are a later
        // slice, and pointing at one that has not been generated is exactly the
        // dangling reference `validateCsm` exists to catch.
        components: SEBI_CSM.components.map((c) => ({ ...c, packageId: null })),
        interfaces: SEBI_CSM.interfaces,
      };
    case 'csm_entities':
      return { entities: SEBI_CSM.entities };
    case 'csm_useCases':
      return { useCases: SEBI_CSM.useCases };
    case 'csm_flows':
      return { flows: SEBI_CSM.flows };
    case 'csm_processes':
      return { processes: SEBI_CSM.processes };
    case 'csm_stateMachines':
      return { stateMachines: SEBI_CSM.stateMachines };
    case 'csm_deployment':
      return { deployment: SEBI_CSM.deployment };
    case 'csm_packages':
      return { packages: SEBI_CSM.packages };
    case 'csm_qualities':
      return { timings: SEBI_CSM.timings, nfrs: SEBI_CSM.nfrs };
    case 'revision_plan':
      return { rationale: 'Add a reviewing compliance officer.', slices: ['core'] };
    case 'patch_core':
      return {
        meta: null,
        upsertActors: [
          {
            id: 'compliance-reviewer',
            name: 'Compliance Reviewer',
            kind: 'human',
            goals: ['Approve the gap analysis before publication'],
          },
        ],
        upsertComponents: [],
        upsertInterfaces: [],
        removeActorIds: [],
        removeComponentIds: [],
        removeInterfaceIds: [],
      };
    default:
      throw new Error(`fakeGroq has no canned response for schema "${schemaName}"`);
  }
}

export interface FakeGroqCall {
  schemaName: string;
  model: string;
}

export function createFakeGroq(): { client: Groq; calls: FakeGroqCall[] } {
  const calls: FakeGroqCall[] = [];

  const client = {
    chat: {
      completions: {
        create: async (params: {
          model: string;
          response_format: { json_schema: { name: string } };
        }) => {
          const schemaName = params.response_format.json_schema.name;
          calls.push({ schemaName, model: params.model });

          return {
            model: params.model,
            choices: [{ message: { content: JSON.stringify(responseFor(schemaName)), reasoning: null } }],
            usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
          };
        },
      },
    },
  };

  return { client: client as unknown as Groq, calls };
}
