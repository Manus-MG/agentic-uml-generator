import type { Csm } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, escInline, truncate, wrap } from './lib.js';
import type { ProjectOptions } from './types.js';

/** Extracts a numeric tick from labels like "0ms", "T+2s", "120". */
function tick(at: string, index: number): number {
  const match = at.match(/(-?\d+(?:\.\d+)?)\s*(ms|s|m)?/i);
  if (!match) return index * 100;
  const value = Number.parseFloat(match[1]!);
  const unit = (match[2] ?? 'ms').toLowerCase();
  if (unit === 's') return Math.round(value * 1000);
  if (unit === 'm') return Math.round(value * 60_000);
  return Math.round(value);
}

export function projectTiming(csm: Csm, options: ProjectOptions = {}): string {
  const timings = options.focusId
    ? csm.timings.filter((t) => t.subjectId === options.focusId)
    : csm.timings;

  if (timings.length === 0) {
    return emptyDiagram(
      'Timing Diagram',
      'The model records no timelines or SLAs. Describe latency budgets or time-ordered states to generate one.',
    );
  }

  const nameOf = (id: string) =>
    csm.components.find((c) => c.id === id)?.name ??
    csm.entities.find((e) => e.id === id)?.name ??
    csm.actors.find((a) => a.id === id)?.name ??
    id;

  const body: string[] = [];
  for (const timing of timings) {
    body.push(`robust "${esc(truncate(nameOf(timing.subjectId), 30))}" as ${alias(timing.subjectId)}`);
  }
  body.push('');

  // Group by tick so every lifeline is positioned within a single `@t` block,
  // which is how PlantUML expects timing statements to be ordered.
  const ticks = new Map<number, string[]>();
  for (const timing of timings) {
    timing.timeline.forEach((point, index) => {
      const at = tick(point.at, index);
      const line = `${alias(timing.subjectId)} is ${escInline(truncate(point.state, 24)).replace(/\s+/g, '_')}`;
      const list = ticks.get(at);
      if (list) list.push(line);
      else ticks.set(at, [line]);
    });
  }

  for (const at of [...ticks.keys()].sort((a, b) => a - b)) {
    body.push(`@${at}`);
    body.push(...ticks.get(at)!);
  }

  const slas = timings.flatMap((t) => t.slas);
  if (slas.length > 0) {
    body.push('');
    body.push('legend right');
    for (const sla of slas) {
      body.push(`  ${escInline(truncate(sla.name, 40))}: ${sla.budgetMs} ms`);
    }
    body.push('end legend');
  }

  return wrap(body, { title: `${csm.meta.name || 'System'} — Timing & SLAs` });
}
