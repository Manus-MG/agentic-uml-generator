import { DIAGRAM_SPECS } from './diagramRegistry.js';

/** Built once: every accepted spelling mapped to its canonical diagram id. */
const ALIAS_TO_ID = new Map<string, string>();
for (const spec of Object.values(DIAGRAM_SPECS)) {
  ALIAS_TO_ID.set(spec.id.toLowerCase(), spec.id);
  for (const alias of spec.aliases) {
    ALIAS_TO_ID.set(alias.toLowerCase(), spec.id);
  }
}

function normalise(input: string): string {
  return input.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-?diagrams?$/, '');
}

export interface ResolveResult {
  resolved: string[];
  unknown: string[];
}

/**
 * Maps user-supplied diagram type names onto canonical ids.
 *
 * The brief's own example asks for `"sequential"`, which is not a UML diagram
 * type — so tolerating near-misses is a requirement, not a nicety. What we do
 * not do is guess: an unrecognised name is reported back with the valid options
 * rather than being silently mapped to something plausible.
 */
export function resolveDiagramTypes(requested: string[]): ResolveResult {
  const resolved: string[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const raw of requested) {
    const id = ALIAS_TO_ID.get(normalise(raw));
    if (!id) {
      unknown.push(raw);
      continue;
    }
    if (!seen.has(id)) {
      seen.add(id);
      resolved.push(id);
    }
  }

  return { resolved, unknown };
}

/** Every accepted spelling, for error messages and the client's picker. */
export function knownDiagramTypes(): { id: string; aliases: string[] }[] {
  return Object.values(DIAGRAM_SPECS).map((spec) => ({ id: spec.id, aliases: spec.aliases }));
}
