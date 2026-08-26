import { describe, expect, it } from 'vitest';
import { DIAGRAM_SPECS } from '../src/agent/diagramRegistry.js';
import { emptyCsm, type Csm } from '../src/agent/schemas/csm.js';
import { projectActivity } from '../src/projectors/activity.js';
import { getBackend, staticLint } from '../src/plantuml/index.js';
import { SEBI_CSM } from './fixtures/sebiCsm.js';

const specs = Object.values(DIAGRAM_SPECS);
const hasJava = await getBackend().available();

describe('projectors', () => {
  it('covers all 14 UML diagram types', () => {
    expect(specs).toHaveLength(14);
  });

  for (const spec of specs) {
    describe(spec.id, () => {
      const source = spec.project(SEBI_CSM, {});

      it('emits a single well-formed diagram', () => {
        expect(source.startsWith('@startuml')).toBe(true);
        expect(source.trimEnd().endsWith('@enduml')).toBe(true);
      });

      it('passes static lint', () => {
        expect(staticLint(source, { bannedKeywords: spec.bannedKeywords })).toEqual([]);
      });

      it('is stable', () => {
        expect(source).toMatchSnapshot();
      });

      // A projector that throws on a thin model would turn a partial CSM into a
      // 500; every one of them is required to degrade to a placeholder instead.
      it('degrades to a placeholder on an empty model', () => {
        const empty = spec.project(emptyCsm(), {});
        expect(empty.startsWith('@startuml')).toBe(true);
        expect(staticLint(empty, { bannedKeywords: spec.bannedKeywords })).toEqual([]);
      });

      it.skipIf(!hasJava)('is accepted by plantuml.jar', async () => {
        const result = await getBackend().verify(source);
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
      });
    });
  }
});

/**
 * Regression: a live model produced a process whose start node carried no lane
 * while everything downstream did. The projector emitted `start` first and
 * PlantUML rejected the diagram, which then burned two LLM repair attempts and
 * still failed. A laned process must open its first lane before `start`.
 */
describe('activity swimlanes', () => {
  const laned = (startLaneId: string | null): Csm => ({
    ...emptyCsm(),
    meta: { ...emptyCsm().meta, name: 'Laned' },
    processes: [
      {
        id: 'p1',
        name: 'Laned Process',
        lanes: [
          { id: 'fetcher', name: 'Circular Fetcher' },
          { id: 'parser', name: 'Clause Parser' },
        ],
        activities: [
          { id: 'a0', name: 'start', type: 'start', laneId: startLaneId },
          { id: 'a1', name: 'Fetch circular', type: 'action', laneId: 'fetcher' },
          { id: 'a2', name: 'Parse clauses', type: 'action', laneId: 'parser' },
          { id: 'a3', name: 'end', type: 'end', laneId: 'parser' },
        ],
        transitions: [
          { fromId: 'a0', toId: 'a1', guard: null },
          { fromId: 'a1', toId: 'a2', guard: null },
          { fromId: 'a2', toId: 'a3', guard: null },
        ],
      },
    ],
  });

  for (const [label, startLaneId] of [
    ['start has no lane of its own', null],
    ['start declares a lane', 'fetcher'],
  ] as const) {
    it(`opens a swimlane before start when ${label}`, async () => {
      const source = projectActivity(laned(startLaneId), {});
      const body = source.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('skinparam'));

      const laneIndex = body.findIndex((l) => l.startsWith('|'));
      const startIndex = body.indexOf('start');

      expect(laneIndex).toBeGreaterThan(-1);
      expect(laneIndex).toBeLessThan(startIndex);

      if (hasJava) {
        expect((await getBackend().verify(source)).errors).toEqual([]);
      }
    });
  }

  it('emits no swimlane for a process that has no lanes', () => {
    const csm = laned(null);
    csm.processes[0]!.lanes = [];
    for (const activity of csm.processes[0]!.activities) activity.laneId = null;

    expect(projectActivity(csm, {}).split('\n').some((l) => l.startsWith('|'))).toBe(false);
  });
});
