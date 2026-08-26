import type { Csm } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, indent, truncate, wrap } from './lib.js';

/** Package diagram: namespaces, what lives in them, and the dependencies between them. */
export function projectPackage(csm: Csm): string {
  if (csm.packages.length === 0) {
    return emptyDiagram(
      'Package Diagram',
      'The model defines no packages. Describe how the system is layered or modularised to generate one.',
    );
  }

  const body: string[] = [];

  for (const pkg of csm.packages) {
    const members = csm.components.filter(
      (c) => pkg.containsComponentIds.includes(c.id) || c.packageId === pkg.id,
    );
    if (members.length === 0) {
      body.push(`package "${esc(truncate(pkg.name, 40))}" as ${alias(pkg.id)}`);
      continue;
    }
    body.push(`package "${esc(truncate(pkg.name, 40))}" as ${alias(pkg.id)} {`);
    body.push(...indent(members.map((c) => `[${esc(truncate(c.name, 36))}] as ${alias(c.id)}`)));
    body.push('}');
  }

  body.push('');
  for (const pkg of csm.packages) {
    for (const dep of pkg.dependsOn) {
      body.push(`${alias(pkg.id)} ..> ${alias(dep)}`);
    }
  }

  return wrap(body, {
    title: `${csm.meta.name || 'System'} — Packages`,
    directives: ['skinparam componentStyle rectangle'],
  });
}
