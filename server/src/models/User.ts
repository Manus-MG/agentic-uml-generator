import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * A user of the UML platform.
 *
 * Identified by a display name (e.g. "Tony") and a generated `userId` (e.g. "usr_tony").
 * Normalized name ensures case-insensitive lookup.
 */
const UserSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User = model('User', UserSchema);
