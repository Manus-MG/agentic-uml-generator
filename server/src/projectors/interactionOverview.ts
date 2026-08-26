import type { Csm } from '../agent/schemas/csm.js';
import { emptyDiagram, esc, escInline, indent, truncate, wrap } from './lib.js';

/**
 * Interaction overview: a storyboard stitching the individual interactions
 * together with control flow.
 *
 * PlantUML expresses this as an activity diagram whose actions are `ref` blocks
 * pointing at other interactions — which maps exactly onto the CSM's list of
 * flows, sequenced by the processes that invoke them.
 */
export function projectInteractionOverview(csm: Csm): string {
  if (csm.flows.length === 0) {
    return emptyDiagram(
      'Interaction Overview Diagram',
      'The model contains no interaction flows to stitch together.',
    );
  }

  const nameOf = (id: string) =>
    csm.actors.find((a) => a.id === id)?.name ?? csm.components.find((c) => c.id === id)?.name ?? id;

  const body: string[] = ['start'];

  csm.flows.forEach((flow, index) => {
    const over = flow.participants
      .slice(0, 3)
      .map((id) => esc(truncate(nameOf(id), 24)))
      .join(', ');

    body.push(`:ref over ${over || 'System'}`);
    body.push(...indent([escInline(truncate(flow.name, 60))], 1));
    if (flow.trigger.trim() !== '') {
      body.push(...indent([`(on ${escInline(truncate(flow.trigger, 46))})`], 1));
    }
    body.push('end ref;');

    if (index < csm.flows.length - 1 && flow.errorPaths.length > 0) {
      body.push(`if (${escInline(truncate(flow.errorPaths[0]!.when, 40))}) then (yes)`);
      body.push(...indent([`:${escInline(truncate(flow.errorPaths[0]!.action, 50))};`, 'stop']));
      body.push('else (no)');
      body.push(...indent([':continue;']));
      body.push('endif');
    }
  });

  body.push('stop');

  return wrap(body, { title: `${csm.meta.name || 'System'} — Interaction Overview` });
}
