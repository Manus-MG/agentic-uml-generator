import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One conversation. The user-facing index over everything else: the CSM
 * versions, the diagrams projected from them, and the LLM trajectories that
 * produced them all hang off `sessionId`.
 *
 * The session id comes from the client (it is a path parameter, exactly as in
 * the brief's `/generate/{session_id}`), so it is the natural key rather than a
 * generated `_id`.
 */
const TurnSchema = new Schema(
  {
    version: { type: Number, required: true },
    prompt: { type: String, required: true },
    /** 'generate' for the first turn, 'revise' for every turn after it. */
    kind: { type: String, enum: ['generate', 'revise'], required: true },
    diagramTypes: { type: [String], default: [] },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const ThreadSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    /** The original brief. Revisions are recorded as turns, not by overwriting this. */
    brief: { type: String, required: true },
    /** Canonical diagram ids requested so far; a revision with no types reuses these. */
    diagramTypes: { type: [String], default: [] },
    currentVersion: { type: Number, default: 0 },
    turns: { type: [TurnSchema], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Working state is disposable; feedback and trajectories are not, and have no TTL.
ThreadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ThreadDoc = InferSchemaType<typeof ThreadSchema>;
export const Thread = model('Thread', ThreadSchema);
