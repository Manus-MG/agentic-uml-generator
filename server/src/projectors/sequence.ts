import type { Csm, CsmFlow } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, escInline, truncate, wrap } from './lib.js';
import type { ProjectOptions } from './types.js';

/** PlantUML lifeline keyword per participant kind — a database reads better than a plain box. */
function lifelineKeyword(csm: Csm, id: string): string {
  if (csm.actors.some((a) => a.id === id)) return 'actor';
  const component = csm.components.find((c) => c.id === id);
  switch (component?.kind) {
    case 'db':
      return 'database';
    case 'queue':
      return 'queue';
    case 'ui':
      return 'boundary';
    case 'job':
      return 'control';
    default:
      return 'participant';
  }
}

function displayName(csm: Csm, id: string): string {
  return (
    csm.actors.find((a) => a.id === id)?.name ??
    csm.components.find((c) => c.id === id)?.name ??
    id
  );
}

const ARROW = { sync: '->', async: '->>', return: '-->' } as const;

/**
 * Renders one flow as a sequence diagram.
 *
 * Fragment handling: steps carry a nullable `group`, and a contiguous run of
 * steps sharing the same group value forms one `alt`/`loop`/`par` block. This
 * is deliberately simpler than UML allows — no nesting — because a flat model
 * of fragments can always be closed correctly, whereas a nested one emitted
 * from a flat list is where unbalanced `end` statements come from.
 */
export function projectSequence(csm: Csm, options: ProjectOptions = {}): string {
  const flow = pickFlow(csm, options.focusId ?? null);
  if (!flow) {
    return emptyDiagram(
      'Sequence Diagram',
      'The model contains no interaction flows. Describe a request/response scenario to generate one.',
    );
  }

  const body: string[] = [];

  for (const id of flow.participants) {
    body.push(`${lifelineKeyword(csm, id)} "${esc(truncate(displayName(csm, id), 40))}" as ${alias(id)}`);
  }
  body.push('');

  if (flow.trigger.trim() !== '' && flow.participants.length > 0) {
    body.push(`note over ${alias(flow.participants[0]!)} : Trigger: ${escInline(truncate(flow.trigger, 70))}`);
    body.push('');
  }

  let openGroup: string | null = null;
  for (const step of flow.steps) {
    if (step.group !== openGroup) {
      if (openGroup !== null) body.push('end');
      if (step.group !== null) {
        const label = step.condition ? ` ${escInline(truncate(step.condition, 60))}` : '';
        body.push(`${step.group}${label}`);
      }
      openGroup = step.group;
    }
    const arrow = ARROW[step.kind];
    const label = escInline(truncate(step.message, 80));
    body.push(`${alias(step.fromId)} ${arrow} ${alias(step.toId)} : ${label}`);
  }
  if (openGroup !== null) body.push('end');

  if (flow.errorPaths.length > 0) {
    body.push('');
    body.push('group Error handling');
    for (const path of flow.errorPaths) {
      body.push(
        `note over ${alias(path.handledBy)} : ${escInline(truncate(path.when, 50))} → ${escInline(truncate(path.action, 50))}`,
      );
    }
    body.push('end');
  }

  return wrap(body, {
    title: flow.name,
    directives: ['skinparam sequenceMessageAlign center', 'skinparam maxMessageSize 220', 'autonumber'],
  });
}

/** The flow with the most steps is the one worth showing when no focus is given. */
function pickFlow(csm: Csm, focusId: string | null): CsmFlow | undefined {
  if (focusId) {
    const match = csm.flows.find((f) => f.id === focusId);
    if (match) return match;
  }
  return [...csm.flows].sort((a, b) => b.steps.length - a.steps.length)[0];
}
