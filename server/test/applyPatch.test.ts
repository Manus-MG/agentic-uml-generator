import { describe, expect, it } from 'vitest';
import { applyPatch, emptyPatch } from '../src/agent/schemas/csmPatch.js';
import { toCsmPatch } from '../src/agent/schemas/slicePatch.js';
import { SEBI_CSM } from './fixtures/sebiCsm.js';

const NEW_ACTOR = {
  id: 'compliance-reviewer',
  name: 'Compliance Reviewer',
  kind: 'human' as const,
  goals: ['Approve the gap analysis'],
};

describe('applyPatch', () => {
  it('adds by id without disturbing the base model', () => {
    const patch = emptyPatch();
    patch.upsert.actors = [NEW_ACTOR];

    const before = SEBI_CSM.actors.length;
    const result = applyPatch(SEBI_CSM, patch);

    expect(result.csm.actors).toHaveLength(before + 1);
    expect(SEBI_CSM.actors).toHaveLength(before); // input untouched
    expect(result.changedSlices.has('actors')).toBe(true);
    expect(result.touchedIds).toContain('compliance-reviewer');
  });

  it('replaces rather than duplicates when the id already exists', () => {
    const existing = SEBI_CSM.actors[0]!;
    const patch = emptyPatch();
    patch.upsert.actors = [{ ...existing, name: 'Renamed' }];

    const result = applyPatch(SEBI_CSM, patch);

    expect(result.csm.actors).toHaveLength(SEBI_CSM.actors.length);
    expect(result.csm.actors.find((a) => a.id === existing.id)?.name).toBe('Renamed');
  });

  it('is idempotent when replayed', () => {
    const patch = emptyPatch();
    patch.upsert.actors = [NEW_ACTOR];

    const once = applyPatch(SEBI_CSM, patch).csm;
    const twice = applyPatch(once, patch).csm;

    expect(twice.actors).toEqual(once.actors);
  });

  it('removes by id', () => {
    const victim = SEBI_CSM.entities[0]!.id;
    const patch = emptyPatch();
    patch.remove.entities = [victim];

    const result = applyPatch(SEBI_CSM, patch);

    expect(result.csm.entities.find((e) => e.id === victim)).toBeUndefined();
    expect(result.changedSlices.has('entities')).toBe(true);
  });

  it('reports no change for an empty patch', () => {
    const result = applyPatch(SEBI_CSM, emptyPatch());
    expect([...result.changedSlices]).toEqual([]);
    expect(result.touchedIds).toEqual([]);
  });
});

describe('toCsmPatch', () => {
  it('maps a core slice patch onto the whole-model patch shape', () => {
    const patch = toCsmPatch(
      'core',
      {
        meta: null,
        upsertActors: [NEW_ACTOR],
        upsertComponents: [],
        upsertInterfaces: [],
        removeActorIds: ['gone'],
        removeComponentIds: [],
        removeInterfaceIds: [],
      },
      'because',
    );

    expect(patch.rationale).toBe('because');
    expect(patch.upsert.actors).toEqual([NEW_ACTOR]);
    expect(patch.remove.actors).toEqual(['gone']);
  });

  it('maps an id-keyed slice patch', () => {
    const entity = SEBI_CSM.entities[0]!;
    const patch = toCsmPatch('entities', { upsert: [entity], removeIds: ['x'] }, 'r');

    expect(patch.upsert.entities).toEqual([entity]);
    expect(patch.remove.entities).toEqual(['x']);
  });

  it('maps wholesale-replacement slices', () => {
    const deployment = toCsmPatch('deployment', { deployment: SEBI_CSM.deployment }, 'r');
    expect(deployment.upsert.deployment).toEqual(SEBI_CSM.deployment);

    const qualities = toCsmPatch(
      'qualities',
      { timings: SEBI_CSM.timings, nfrs: SEBI_CSM.nfrs },
      'r',
    );
    expect(qualities.upsert.nfrs).toEqual(SEBI_CSM.nfrs);
  });

  it('round-trips a slice patch through applyPatch', () => {
    const patch = toCsmPatch(
      'core',
      {
        meta: null,
        upsertActors: [NEW_ACTOR],
        upsertComponents: [],
        upsertInterfaces: [],
        removeActorIds: [],
        removeComponentIds: [],
        removeInterfaceIds: [],
      },
      'r',
    );
    const result = applyPatch(SEBI_CSM, patch);

    expect(result.csm.actors.map((a) => a.id)).toContain('compliance-reviewer');
    expect([...result.changedSlices]).toEqual(['actors']);
  });
});
