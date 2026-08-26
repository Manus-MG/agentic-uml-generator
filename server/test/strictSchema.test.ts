import { describe, expect, it } from 'vitest';
import { CsmSchema } from '../src/agent/schemas/csm.js';
import { CsmPatchSchema } from '../src/agent/schemas/csmPatch.js';
import { RequirementModelSchema } from '../src/agent/schemas/requirements.js';
import { SLICES } from '../src/agent/schemas/slices.js';
import { RevisionPlanSchema, SLICE_PATCH_SCHEMAS } from '../src/agent/schemas/slicePatch.js';
import { findStrictViolations, toStrictJsonSchema } from '../src/agent/schemas/strictJsonSchema.js';

/**
 * Groq's constrained decoder rejects a schema that is not strict-mode clean,
 * and it does so at request time — so a single `.optional()` slipping into a
 * schema file breaks generation in production and nowhere earlier. This suite
 * is that earlier place.
 */
const schemas = {
  CsmSchema,
  CsmPatchSchema,
  RequirementModelSchema,
  RevisionPlanSchema,
  ...Object.fromEntries(Object.entries(SLICES).map(([name, def]) => [`slice:${name}`, def.schema])),
  ...Object.fromEntries(Object.entries(SLICE_PATCH_SCHEMAS).map(([name, s]) => [`patch:${name}`, s])),
};

describe('strict json schema', () => {
  for (const [name, schema] of Object.entries(schemas)) {
    it(`${name} is strict-mode clean`, () => {
      const json = toStrictJsonSchema(schema, 'x');
      expect(findStrictViolations(json)).toEqual([]);
    });
  }
});
