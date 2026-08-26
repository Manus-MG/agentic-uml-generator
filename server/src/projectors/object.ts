import type { Csm } from '../agent/schemas/csm.js';
import { alias, emptyDiagram, esc, escInline, truncate, wrap } from './lib.js';

/**
 * Object diagram: a runtime snapshot of instances.
 *
 * The CSM stores types, not instances, so we synthesise one plausible instance
 * per entity with illustrative values derived from the attribute types. That is
 * exactly what an object diagram is for — a worked example that pins down
 * multiplicities the class diagram leaves abstract.
 */
function sampleValue(type: string, attributeName: string): string {
  const t = type.toLowerCase();
  if (t.includes('bool')) return 'true';
  if (t.includes('int') || t.includes('number') || t.includes('float') || t.includes('decimal')) return '42';
  if (t.includes('date') || t.includes('time')) return '"2026-08-26T09:00:00Z"';
  if (t.includes('[]') || t.includes('list') || t.includes('array')) return '[…]';
  return `"${esc(truncate(`sample-${attributeName}`, 24))}"`;
}

export function projectObject(csm: Csm): string {
  if (csm.entities.length === 0) {
    return emptyDiagram(
      'Object Diagram',
      'The model contains no data entities, so there are no instances to snapshot.',
    );
  }

  const body: string[] = [];
  const instanceAlias = (entityId: string) => `${alias(entityId)}_1`;

  for (const entity of csm.entities) {
    const label = `${esc(truncate(`a${/^[aeiou]/i.test(entity.name) ? 'n' : ''} ${entity.name}`, 30))} : ${esc(truncate(entity.name, 30))}`;
    const shown = entity.attributes.slice(0, 6);
    if (shown.length === 0) {
      body.push(`object "${label}" as ${instanceAlias(entity.id)}`);
      continue;
    }
    body.push(`object "${label}" as ${instanceAlias(entity.id)} {`);
    for (const attribute of shown) {
      const value = attribute.pii ? '"«redacted»"' : sampleValue(attribute.type, attribute.name);
      body.push(`  ${escInline(attribute.name)} = ${value}`);
    }
    body.push('}');
  }

  body.push('');
  for (const entity of csm.entities) {
    for (const relation of entity.relations) {
      if (relation.kind === 'inherits') continue; // instances do not inherit
      const label = relation.label ? ` : ${escInline(truncate(relation.label, 30))}` : '';
      body.push(`${instanceAlias(entity.id)} --> ${instanceAlias(relation.toId)}${label}`);
    }
  }

  return wrap(body, {
    title: `${csm.meta.name || 'System'} — Runtime Snapshot`,
    directives: ['skinparam classAttributeIconSize 0'],
  });
}
