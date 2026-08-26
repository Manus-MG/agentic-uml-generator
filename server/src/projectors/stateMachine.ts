import { PSEUDOSTATE } from '../agent/csmIntegrity.js';
import type { Csm, CsmStateMachine } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, escInline, truncate, wrap } from './lib.js';
import type { ProjectOptions } from './types.js';

/** `[*]` passes through untouched; anything else becomes a sanitised alias. */
function stateRef(id: string): string {
  return id === PSEUDOSTATE ? PSEUDOSTATE : alias(id);
}

export function projectStateMachine(csm: Csm, options: ProjectOptions = {}): string {
  const machine = pickMachine(csm, options.focusId ?? null);
  if (!machine) {
    return emptyDiagram(
      'State Machine Diagram',
      'The model defines no lifecycles. Describe how a key object changes state over time to generate one.',
    );
  }

  const subject =
    csm.entities.find((e) => e.id === machine.subjectId)?.name ??
    csm.components.find((c) => c.id === machine.subjectId)?.name ??
    machine.subjectId;

  const body: string[] = [];

  for (const state of machine.states) {
    body.push(`state "${esc(truncate(state.name, 40))}" as ${alias(state.id)}`);
  }
  body.push('');

  for (const transition of machine.transitions) {
    const parts: string[] = [escInline(truncate(transition.event, 40))];
    if (transition.guard) parts.push(`[${escInline(truncate(transition.guard, 30))}]`);
    if (transition.action) parts.push(`/ ${escInline(truncate(transition.action, 30))}`);
    const label = parts.filter(Boolean).join(' ').trim();
    const arrow = `${stateRef(transition.fromId)} --> ${stateRef(transition.toId)}`;
    body.push(label ? `${arrow} : ${label}` : arrow);
  }

  // entry/exit actions are attached with the `state : text` form rather than a
  // braced body, which keeps them valid even for states with no substates.
  const annotations = machine.states.flatMap((state) => {
    const lines: string[] = [];
    if (state.entry) lines.push(`${alias(state.id)} : entry / ${escInline(truncate(state.entry, 40))}`);
    if (state.exit) lines.push(`${alias(state.id)} : exit / ${escInline(truncate(state.exit, 40))}`);
    return lines;
  });
  if (annotations.length > 0) {
    body.push('');
    body.push(...annotations);
  }

  return wrap(body, { title: `${subject} — Lifecycle` });
}

function pickMachine(csm: Csm, focusId: string | null): CsmStateMachine | undefined {
  if (focusId) {
    const match = csm.stateMachines.find((m) => m.id === focusId || m.subjectId === focusId);
    if (match) return match;
  }
  return [...csm.stateMachines].sort((a, b) => b.states.length - a.states.length)[0];
}
