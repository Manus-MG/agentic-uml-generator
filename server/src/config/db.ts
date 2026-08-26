import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connects to MongoDB, or refuses to start.
 *
 * The previous implementation logged the failure and returned normally, so the
 * server came up without a database and every request that touched one failed
 * at runtime instead. A process that cannot do its job should not accept
 * traffic.
 */
export default async function connectDB(): Promise<void> {
  const conn = await mongoose.connect(env().MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
}

const STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export function dbState(): string {
  return STATES[mongoose.connection.readyState] ?? 'unknown';
}
