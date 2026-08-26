import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * An automatically-captured signal about one diagram, written by the pipeline
 * itself — never submitted by a user. There is no rating widget in this app;
 * behavior is the feedback:
 *
 * - `render-quality`: did the PlantUML render cleanly, or need repair, or fail?
 * - `revision-rework`: the user asked for a change that touched this diagram's
 *   slices — the size and speed of that rework is the negative signal.
 * - `survived-carry-forward`: the user kept revising *other* things and left
 *   this diagram alone — the longer that streak, the stronger the implicit
 *   approval.
 *
 * `reward` is materialised here rather than derived at export time so the
 * mapping from signal to scalar is recorded with the judgement, and changing
 * the scheme later cannot silently rewrite history. See
 * server/src/agent/implicitSignals.ts for the formulas.
 *
 * No TTL — this and Trajectory are the two collections the RL export reads.
 */
const FeedbackSchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    /**
     * The Diagram document this signal is about. Optional: a
     * `survived-carry-forward` signal is cumulative per diagram *type*, not
     * tied to any single rendered version.
     */
    diagramId: { type: Schema.Types.ObjectId, ref: 'Diagram', required: false, default: null },
    /**
     * The version that actually produced the content being judged — i.e.
     * `Diagram.originVersion`, not necessarily the version this signal was
     * observed at. This is what `exportFeedback` joins against `Trajectory`
     * with, so a signal about a carried-forward diagram still lands on the
     * turn that has the LLM calls for it.
     */
    version: { type: Number, required: true },
    diagramType: { type: String, required: true },
    signal: {
      type: String,
      enum: ['render-quality', 'revision-rework', 'survived-carry-forward'],
      required: true,
    },
    reward: { type: Number, required: true },
    /** How much weight this signal should carry when blended with others on the same diagram. */
    confidence: { type: Number, required: true, min: 0, max: 1 },
    /** Signal-specific detail (changedSlices, touchedIds, latencyMs, repairAttempts, streak, ...). */
    evidence: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// One row per diagram per signal type; re-observing the same signal updates it in place.
FeedbackSchema.index(
  { sessionId: 1, diagramId: 1, signal: 1 },
  { unique: true, partialFilterExpression: { diagramId: { $exists: true } } },
);
// The cumulative streak signal has no diagramId — keyed by type instead.
FeedbackSchema.index(
  { sessionId: 1, diagramType: 1, signal: 1 },
  { unique: true, partialFilterExpression: { signal: 'survived-carry-forward' } },
);

export type FeedbackDoc = InferSchemaType<typeof FeedbackSchema>;
export const Feedback = model('Feedback', FeedbackSchema);
