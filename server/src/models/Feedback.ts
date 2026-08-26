import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A thumbs up or down on one diagram.
 *
 * The reward is materialised here rather than derived at export time so the
 * mapping from rating to scalar is recorded with the judgement, and changing
 * the scheme later cannot silently rewrite history.
 *
 * No TTL — this and Trajectory are the two collections the RL export reads.
 */
const FeedbackSchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    /** The Diagram document this rates. */
    diagramId: { type: Schema.Types.ObjectId, ref: 'Diagram', required: true },
    version: { type: Number, required: true },
    diagramType: { type: String, required: true },
    rating: { type: String, enum: ['up', 'down'], required: true },
    reward: { type: Number, required: true },
    comments: { type: String, default: null },
  },
  { timestamps: true },
);

// One rating per diagram per session; a re-rating replaces the old one.
FeedbackSchema.index({ sessionId: 1, diagramId: 1 }, { unique: true });

export type FeedbackDoc = InferSchemaType<typeof FeedbackSchema>;
export const Feedback = model('Feedback', FeedbackSchema);
