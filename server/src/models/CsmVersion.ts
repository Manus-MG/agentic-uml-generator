import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * The canonical system model as it stood at the end of one turn.
 *
 * Every version is kept rather than overwritten: a revision is a patch against
 * version N producing version N+1, and keeping both is what makes a bad
 * revision recoverable and a diff explainable.
 *
 * `csm` is Mixed on purpose. `CsmSchema` (zod) is the single authority on that
 * shape — mirroring it in a mongoose schema would create a second definition to
 * keep in sync, and the two would drift.
 */
const CsmVersionSchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    csm: { type: Schema.Types.Mixed, required: true },
    /** The model's explanation of what this revision changed. Null on version 1. */
    rationale: { type: String, default: null },
    /** Result of `validateCsm` after any repair attempts. */
    integrity: {
      ok: { type: Boolean, default: true },
      errors: { type: [Schema.Types.Mixed], default: [] },
      warnings: { type: [Schema.Types.Mixed], default: [] },
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

CsmVersionSchema.index({ sessionId: 1, version: -1 });
CsmVersionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type CsmVersionDoc = InferSchemaType<typeof CsmVersionSchema>;
export const CsmVersion = model('CsmVersion', CsmVersionSchema);
