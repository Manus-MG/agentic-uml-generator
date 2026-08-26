import type { Csm } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, indent, stereotype, truncate, wrap } from './lib.js';

/**
 * Component diagram: building blocks plus provided/required interfaces.
 *
 * Provided interfaces attach with a plain line (`-`), which PlantUML renders as
 * the lollipop; required interfaces use a dashed dependency (`..>`). That
 * asymmetry is the whole point of the diagram, so it is worth being exact about.
 *
 * Layout note: each interface is declared immediately after the component that
 * provides it, inside the same package block. PlantUML delegates placement to
 * Graphviz, which keeps declaration-adjacent nodes near each other — declaring
 * all the interfaces in a trailing block instead scatters them across the
 * canvas and produces overlapping labels and long crossing edges.
 */
export function projectComponent(csm: Csm): string {
  if (csm.components.length === 0) {
    return emptyDiagram(
      'Component Diagram',
      'The model contains no components. Describe the services or modules involved to generate one.',
    );
  }

  const declaredInterfaces = new Set<string>();

  const declare = (componentId: string): string[] => {
    const component = csm.components.find((c) => c.id === componentId)!;
    const lines = [`[${esc(truncate(component.name, 36))}] as ${alias(component.id)} ${stereotype(component.kind)}`];
    for (const providedId of component.provides) {
      const iface = csm.interfaces.find((i) => i.id === providedId);
      if (!iface || declaredInterfaces.has(iface.id)) continue;
      declaredInterfaces.add(iface.id);
      lines.push(`interface "${esc(truncate(iface.name, 30))}" as ${alias(iface.id)}`);
      lines.push(`${alias(component.id)} -- ${alias(iface.id)}`);
    }
    return lines;
  };

  const body: string[] = [];
  const placed = new Set<string>();

  for (const pkg of csm.packages) {
    const members = csm.components.filter(
      (c) => pkg.containsComponentIds.includes(c.id) || c.packageId === pkg.id,
    );
    if (members.length === 0) continue;

    body.push(`package "${esc(truncate(pkg.name, 40))}" as ${alias(pkg.id)} {`);
    for (const member of members) {
      placed.add(member.id);
      body.push(...indent(declare(member.id)));
    }
    body.push('}');
    body.push('');
  }

  const loose = csm.components.filter((c) => !placed.has(c.id));
  for (const component of loose) {
    body.push(...declare(component.id));
  }

  // Any interface whose provider was never declared (shouldn't happen after
  // integrity validation, but the projector must stay total).
  const orphans = csm.interfaces.filter((i) => !declaredInterfaces.has(i.id));
  if (orphans.length > 0) {
    body.push('');
    for (const iface of orphans) {
      body.push(`interface "${esc(truncate(iface.name, 30))}" as ${alias(iface.id)}`);
    }
  }

  const dependencies: string[] = [];
  for (const component of csm.components) {
    for (const requiredId of component.requires) {
      dependencies.push(`${alias(component.id)} ..> ${alias(requiredId)} : uses`);
    }
  }
  if (dependencies.length > 0) {
    body.push('');
    body.push(...dependencies);
  }

  return wrap(body, {
    title: `${csm.meta.name || 'System'} — Components`,
    directives: [
      'left to right direction',
      'skinparam componentStyle rectangle',
      'skinparam nodesep 30',
      'skinparam ranksep 90',
      'skinparam packageStyle rectangle',
    ],
  });
}
