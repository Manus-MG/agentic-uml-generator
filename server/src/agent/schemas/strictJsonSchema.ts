import { z } from 'zod';

export interface StrictViolation {
  /** JSON-pointer-ish path into the generated schema. */
  path: string;
  code: 'missing-additional-properties' | 'incomplete-required' | 'unsupported-keyword';
  message: string;
}

/** Keywords Groq's constrained decoder does not implement. */
const UNSUPPORTED_KEYWORDS = [
  'patternProperties',
  'oneOf',
  'not',
  'if',
  'then',
  'else',
  'dependentSchemas',
  'unevaluatedProperties',
];

/**
 * Walks a generated JSON Schema and reports every place it violates Groq's
 * strict-mode contract:
 *
 *   - every object sets `additionalProperties: false`
 *   - every declared property appears in `required`
 *   - no unsupported keywords
 *
 * The second rule is the subtle one. `z.optional()` drops a field from
 * `required`, which Groq rejects outright — so optionality in our schemas is
 * always `z.nullable()`. This function is what stops that mistake reaching
 * production as a runtime 400.
 */
export function findStrictViolations(schema: unknown, path = '#'): StrictViolation[] {
  const out: StrictViolation[] = [];
  if (schema === null || typeof schema !== 'object') return out;

  if (Array.isArray(schema)) {
    schema.forEach((item, i) => out.push(...findStrictViolations(item, `${path}/${i}`)));
    return out;
  }

  const node = schema as Record<string, unknown>;

  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (keyword in node) {
      out.push({
        path,
        code: 'unsupported-keyword',
        message: `"${keyword}" is not supported by Groq strict structured outputs`,
      });
    }
  }

  const properties = node.properties as Record<string, unknown> | undefined;
  if (properties && typeof properties === 'object') {
    if (node.additionalProperties !== false) {
      out.push({
        path,
        code: 'missing-additional-properties',
        message: 'object must set "additionalProperties": false',
      });
    }
    const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
    const missing = Object.keys(properties).filter((k) => !required.has(k));
    if (missing.length > 0) {
      out.push({
        path,
        code: 'incomplete-required',
        message:
          `every property must be required; missing: ${missing.join(', ')}. ` +
          'Use .nullable() rather than .optional().',
      });
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'required' || key === 'enum' || key === 'const') continue;
    out.push(...findStrictViolations(value, `${path}/${key}`));
  }

  return out;
}

/**
 * Converts a Zod schema into a JSON Schema that Groq will accept under
 * `strict: true`, throwing rather than emitting one that would be rejected at
 * request time.
 */
export function toStrictJsonSchema(schema: z.ZodType, name = 'schema'): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>;

  // Groq reads the schema from the request body; a $schema key is noise.
  delete json.$schema;

  const violations = findStrictViolations(json);
  if (violations.length > 0) {
    const detail = violations.map((v) => `  - ${v.path}: ${v.message}`).join('\n');
    throw new Error(`Schema "${name}" is not valid for Groq strict mode:\n${detail}`);
  }
  return json;
}
