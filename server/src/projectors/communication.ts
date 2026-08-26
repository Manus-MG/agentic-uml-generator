import type { Csm, CsmFlow } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, escInline, truncate, wrap } from './lib.js';
import type { ProjectOptions } from './types.js';

/**
 * Communication diagram: the same interaction as the sequence diagram, but
 * emphasising the links between participants rather than time.
 *
 * PlantUML derives this view from sequence syntax, so the projection is the
 * same message list with explicit sequence numbers and no fragments — the
 * compact network read of the flow.
 */
export function projectCommunication(csm: Csm, options: ProjectOptions = {}): string {
  const flow = pickFlow(csm, options.focusId ?? null);
  if (!flow) {
    return emptyDiagram(
      'Communication Diagram',
      'The model contains no interaction flows. Describe a request/response scenario to generate one.',
    );
  }

  const displayName = (id: string) =>
    csm.actors.find((a) => a.id === id)?.name ?? csm.components.find((c) => c.id === id)?.name ?? id;

  const body: string[] = [];
  for (const id of flow.participants) {
    const keyword = csm.actors.some((a) => a.id === id) ? 'actor' : 'participant';
    body.push(`${keyword} "${esc(truncate(displayName(id), 40))}" as ${alias(id)}`);
  }
  body.push('');

  flow.steps.forEach((step, index) => {
    const arrow = step.kind === 'return' ? '-->' : '->';
    body.push(
      `${alias(step.fromId)} ${arrow} ${alias(step.toId)} : ${index + 1}: ${escInline(truncate(step.message, 60))}`,
    );
  });

  return wrap(body, { title: `${flow.name} — Communication` });
}

function pickFlow(csm: Csm, focusId: string | null): CsmFlow | undefined {
  if (focusId) {
    const match = csm.flows.find((f) => f.id === focusId);
    if (match) return match;
  }
  return [...csm.flows].sort((a, b) => b.steps.length - a.steps.length)[0];
}
