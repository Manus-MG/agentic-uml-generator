import { describe, expect, it } from 'vitest';
import { validateCsm, formatIssues } from '../src/agent/csmIntegrity.js';
import type { Csm } from '../src/agent/schemas/csm.js';
import { SEBI_CSM } from './fixtures/sebiCsm.js';

const clone = (): Csm => structuredClone(SEBI_CSM);
const codes = (csm: Csm) => validateCsm(csm).errors.map((e) => e.code);

/**
 * These checks are what stands between a plausible-looking model and a diagram
 * that references participants it never declared. Constrained decoding
 * guarantees the shape of the JSON; nothing but this guarantees that the ids
 * inside it agree with each other.
 */
describe('validateCsm', () => {
  it('accepts the reference model', () => {
    const report = validateCsm(SEBI_CSM);
    expect(formatIssues(report.errors)).toBe('');
    expect(report.ok).toBe(true);
  });

  it('rejects a duplicate id', () => {
    const csm = clone();
    csm.actors.push({ ...csm.actors[0]! });
    expect(validateCsm(csm).ok).toBe(false);
  });

  it('rejects an entity relation pointing at nothing', () => {
    const csm = clone();
    csm.entities[0]!.relations.push({ toId: 'does-not-exist', kind: 'one-to-many', label: null });
    expect(validateCsm(csm).ok).toBe(false);
  });

  it('rejects an interface whose provider does not claim it', () => {
    const csm = clone();
    const iface = csm.interfaces[0]!;
    const provider = csm.components.find((c) => c.id === iface.providerId)!;
    provider.provides = provider.provides.filter((id) => id !== iface.id);
    expect(validateCsm(csm).ok).toBe(false);
  });

  it('rejects a flow step between undeclared participants', () => {
    const csm = clone();
    const flow = csm.flows[0]!;
    flow.participants = flow.participants.filter((id) => id !== flow.steps[0]!.toId);
    expect(validateCsm(csm).ok).toBe(false);
  });

  it('rejects a process with two start activities', () => {
    const csm = clone();
    const process = csm.processes[0]!;
    const start = process.activities.find((a) => a.type === 'start')!;
    process.activities.push({ ...start, id: `${start.id}-2` });
    expect(validateCsm(csm).ok).toBe(false);
  });

  it('rejects an unbalanced fork/join', () => {
    const csm = clone();
    const process = csm.processes[0]!;
    const join = process.activities.find((a) => a.type === 'join');
    expect(join, 'fixture must contain a fork/join pair').toBeDefined();
    process.activities = process.activities.filter((a) => a.id !== join!.id);
    process.transitions = process.transitions.filter((t) => t.fromId !== join!.id && t.toId !== join!.id);
    expect(validateCsm(csm).ok).toBe(false);
  });

  it('rejects a state machine with no initial transition', () => {
    const csm = clone();
    const machine = csm.stateMachines[0]!;
    machine.transitions = machine.transitions.filter((t) => t.fromId !== '[*]');
    expect(validateCsm(csm).ok).toBe(false);
  });

  it('rejects a placement pointing at a node that does not exist', () => {
    const csm = clone();
    csm.deployment.placements[0]!.nodeId = 'nowhere';
    expect(validateCsm(csm).ok).toBe(false);
  });

  it('reports issues with a path so the repair prompt can target one slice', () => {
    const csm = clone();
    csm.entities[0]!.relations.push({ toId: 'nope', kind: 'one-to-one', label: null });
    const report = validateCsm(csm);
    expect(report.errors.some((e) => e.path.startsWith('entities'))).toBe(true);
    expect(codes(csm).length).toBeGreaterThan(0);
  });
});
