import type { Csm } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, escInline, indent, stereotype, truncate, wrap } from './lib.js';

/**
 * Profile diagram: the domain rules this model encodes, expressed as UML
 * stereotypes extending base metaclasses.
 *
 * The stereotypes are derived rather than invented — one per component kind
 * actually used, one «pii» for regulated data if any entity carries it, and one
 * per NFR category — so the profile documents the vocabulary this particular
 * system model is written in.
 */
export function projectProfile(csm: Csm): string {
  const kinds = [...new Set(csm.components.map((c) => c.kind))];
  const hasPii = csm.entities.some((e) => e.attributes.some((a) => a.pii));
  const nfrCategories = [...new Set(csm.nfrs.map((n) => n.category))].slice(0, 6);

  if (kinds.length === 0 && !hasPii && nfrCategories.length === 0) {
    return emptyDiagram(
      'Profile Diagram',
      'The model defines no components, regulated data or non-functional requirements to derive a profile from.',
    );
  }

  const inner: string[] = [
    'class Component <<metaclass>>',
    'class Class <<metaclass>>',
    '',
  ];

  for (const kind of kinds) {
    const name = kind.replace(/(^|-)([a-z])/g, (_, __, ch: string) => ch.toUpperCase());
    inner.push(`class ${alias(name)} ${stereotype('stereotype')}`);
    inner.push(`${alias(name)} -up-|> Component`);
  }

  if (hasPii) {
    inner.push('');
    inner.push(`class Pii ${stereotype('stereotype')} {`);
    inner.push('  +lawfulBasis : string');
    inner.push('  +retentionDays : int');
    inner.push('}');
    inner.push('Pii -up-|> Class');
  }

  if (nfrCategories.length > 0) {
    inner.push('');
    for (const category of nfrCategories) {
      const name = category.replace(/[^A-Za-z0-9]/g, '');
      if (!name) continue;
      inner.push(`class ${alias(name)} ${stereotype('stereotype')}`);
      inner.push(`${alias(name)} -up-|> Component`);
    }
  }

  const body = [
    `package "${esc(truncate(`${csm.meta.name || 'System'} Profile`, 40))}" <<Frame>> {`,
    ...indent(inner),
    '}',
  ];

  const constraints = csm.nfrs.slice(0, 6);
  if (constraints.length > 0) {
    body.push('');
    body.push('legend right');
    body.push('  **Constraints**');
    for (const nfr of constraints) {
      body.push(`  ${escInline(truncate(`${nfr.category}: ${nfr.statement}`, 78))}`);
    }
    body.push('end legend');
  }

  return wrap(body, { title: `${csm.meta.name || 'System'} — UML Profile` });
}
