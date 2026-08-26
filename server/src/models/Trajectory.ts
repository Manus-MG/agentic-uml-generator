import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One LLM call, recorded in full.
 *
 * This is the RL training record the brief asks for. ART trains on
 * (messages, completion, reward) triples, so the exact prompt sent and the
 * exact completion returned have to be captured at call time — they cannot be
 * reconstructed afterwards, because the prompt depends on the CSM digest as it
 * stood at that moment.
 *
 * `callStructured` already returns all of this; a Trajectory is a direct
 * projection of its `StructuredCallResult`. No TTL: this outlives the session.
 */
const TrajectorySchema = new Schema(
  {
    sessionId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    /** Pipeline step, e.g. 'requirements', 'csm_core', 'csm_flows', 'patch', 'repair_sequence'. */
    step: { type: String, required: true },
    /** Diagram this call was made for, when the step is diagram-specific. */
    diagramType: { type: String, default: null },
    model: { type: String, required: true },
    /** Exactly what was sent, in order. */
    messages: { type: [Schema.Types.Mixed], required: true },
    /** The raw completion string, before parsing. */
    completion: { type: String, required: true },
    reasoning: { type: String, default: null },
    usage: {
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
    durationMs: { type: Number, default: 0 },
    attempts: { type: Number, default: 1 },
  },
  { timestamps: true },
);

TrajectorySchema.index({ sessionId: 1, version: 1 });

export type TrajectoryDoc = InferSchemaType<typeof TrajectorySchema>;
export const Trajectory = model('Trajectory', TrajectorySchema);
