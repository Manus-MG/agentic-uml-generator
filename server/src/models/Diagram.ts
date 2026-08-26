import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One rendered diagram: the PlantUML source, the SVG served inline, and the
 * PNG written to disk.
 *
 * Stored per (session, version, type) so a revision that touches only the
 * `flows` slice can re-render the sequence diagram and carry every other
 * diagram forward untouched — no LLM call, no JVM, no visual churn.
 */
const DiagramSchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    /**
     * The version that actually rendered this content. Equal to `version` for
     * a real render; copied forward unchanged across carry-forwards so a
     * signal about this diagram can still be joined to the `Trajectory` rows
     * that produced it, which a purely-carried-forward version has none of.
     */
    originVersion: { type: Number, required: true },
    /** Canonical diagram id, e.g. 'sequence', 'use-case'. */
    type: { type: String, required: true },
    source: { type: String, required: true },
    svg: { type: String, default: null },
    /** Absolute path on disk; the API exposes it as /api/diagram/:filename. */
    pngPath: { type: String, default: null },
    pngBytes: { type: Number, default: null },
    valid: { type: Boolean, default: false },
    /** Errors left over after repair gave up. Empty when `valid`. Not named `errors`: mongoose reserves that path. */
    renderErrors: { type: [Schema.Types.Mixed], default: [] },
    repairAttempts: { type: Number, default: 0 },
    /** True when this version reused the previous version's render unchanged. */
    carriedForward: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

DiagramSchema.index({ sessionId: 1, version: 1, type: 1 }, { unique: true });
DiagramSchema.index({ sessionId: 1, version: -1 });
DiagramSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type DiagramDoc = InferSchemaType<typeof DiagramSchema>;
export const Diagram = model('Diagram', DiagramSchema);
