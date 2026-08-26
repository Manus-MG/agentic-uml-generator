import type { Csm } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, escInline, truncate, wrap } from './lib.js';

/**
 * `A rel B` rendered per relation kind.
 *
 * Inheritance is the one that reverses: in the CSM, entity A declaring
 * `inherits B` means "A is a B", which PlantUML writes parent-first as
 * `B <|-- A`. Getting this backwards silently inverts every hierarchy.
 */
function relationLine(fromAlias: string, toAlias: string, kind: string): string {
  switch (kind) {
    case 'one-to-one':
      return `${fromAlias} "1" -- "1" ${toAlias}`;
    case 'one-to-many':
      return `${fromAlias} "1" -- "*" ${toAlias}`;
    case 'many-to-many':
      return `${fromAlias} "*" -- "*" ${toAlias}`;
    case 'inherits':
      return `${toAlias} <|-- ${fromAlias}`;
    case 'composes':
      return `${fromAlias} *-- ${toAlias}`;
    default:
      return `${fromAlias} --> ${toAlias}`;
  }
}

export function projectClass(csm: Csm): string {
  if (csm.entities.length === 0) {
    return emptyDiagram(
      'Class Diagram',
      'The model contains no data entities. Describe the data the system stores to generate one.',
    );
  }

  const body: string[] = [];

  for (const entity of csm.entities) {
    const entityAlias = alias(entity.id);
    if (entity.attributes.length === 0) {
      body.push(`class "${esc(truncate(entity.name, 40))}" as ${entityAlias}`);
      continue;
    }
    body.push(`class "${esc(truncate(entity.name, 40))}" as ${entityAlias} {`);
    for (const attribute of entity.attributes) {
      // "[PII]" as plain text rather than a stereotype: member stereotypes are
      // parsed inconsistently, and this renders identically without the risk.
      const pii = attribute.pii ? '  [PII]' : '';
      body.push(`  +${escInline(attribute.name)} : ${escInline(truncate(attribute.type, 30))}${pii}`);
    }
    body.push('}');
  }

  body.push('');

  for (const entity of csm.entities) {
    for (const relation of entity.relations) {
      const line = relationLine(alias(entity.id), alias(relation.toId), relation.kind);
      body.push(relation.label ? `${line} : ${escInline(truncate(relation.label, 40))}` : line);
    }
  }

  const sensitive = csm.entities.filter((e) => e.attributes.some((a) => a.pii));
  if (sensitive.length > 0) {
    body.push('');
    body.push('legend right');
    body.push('  [PII] marks personally identifiable or regulated fields');
    body.push('end legend');
  }

  return wrap(body, {
    title: `${csm.meta.name || 'System'} — Domain Model`,
    directives: ['skinparam classAttributeIconSize 0', 'hide empty members'],
  });
}
