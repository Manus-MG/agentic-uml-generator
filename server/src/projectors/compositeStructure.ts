import type { Csm, CsmComponent } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, indent, truncate, wrap } from './lib.js';
import type { ProjectOptions } from './types.js';

/**
 * Composite structure: the internal wiring of one component — its parts, its
 * ports, and the connectors between them.
 *
 * "Parts" are drawn from the component's own responsibilities, since the CSM
 * models internals as responsibilities rather than as nested components. Ports
 * come from the interfaces it provides (out) and requires (in).
 */
export function projectCompositeStructure(csm: Csm, options: ProjectOptions = {}): string {
  const subject = pickComponent(csm, options.focusId ?? null);
  if (!subject) {
    return emptyDiagram(
      'Composite Structure Diagram',
      'The model contains no components whose internals can be expanded.',
    );
  }

  const interfaceName = new Map(csm.interfaces.map((i) => [i.id, i.name]));
  const parts = subject.responsibilities.slice(0, 8);
  const inner: string[] = [];

  for (const required of subject.requires) {
    inner.push(`portin "${esc(truncate(interfaceName.get(required) ?? required, 26))}" as ${alias(`in_${required}`)}`);
  }
  for (const provided of subject.provides) {
    inner.push(`portout "${esc(truncate(interfaceName.get(provided) ?? provided, 26))}" as ${alias(`out_${provided}`)}`);
  }

  if (parts.length === 0) {
    inner.push(`component "${esc(truncate(subject.name, 30))} core" as ${alias(`${subject.id}_core`)}`);
  } else {
    parts.forEach((part, index) => {
      inner.push(`component "${esc(truncate(part, 34))}" as ${alias(`${subject.id}_p${index}`)}`);
    });
  }

  const partAliases = parts.length === 0
    ? [alias(`${subject.id}_core`)]
    : parts.map((_, index) => alias(`${subject.id}_p${index}`));

  inner.push('');
  for (const required of subject.requires) {
    inner.push(`${alias(`in_${required}`)} --> ${partAliases[0]!}`);
  }
  for (let i = 0; i < partAliases.length - 1; i += 1) {
    inner.push(`${partAliases[i]!} --> ${partAliases[i + 1]!}`);
  }
  for (const provided of subject.provides) {
    inner.push(`${partAliases[partAliases.length - 1]!} --> ${alias(`out_${provided}`)}`);
  }

  const body = [
    `component "${esc(truncate(subject.name, 36))}" as ${alias(subject.id)} {`,
    ...indent(inner),
    '}',
  ];

  return wrap(body, { title: `${subject.name} — Internal Structure` });
}

/** The component with the most connections is the one whose internals are worth showing. */
function pickComponent(csm: Csm, focusId: string | null): CsmComponent | undefined {
  if (focusId) {
    const match = csm.components.find((c) => c.id === focusId);
    if (match) return match;
  }
  return [...csm.components]
    .filter((c) => c.kind !== 'external')
    .sort(
      (a, b) =>
        b.provides.length + b.requires.length + b.responsibilities.length -
        (a.provides.length + a.requires.length + a.responsibilities.length),
    )[0];
}
