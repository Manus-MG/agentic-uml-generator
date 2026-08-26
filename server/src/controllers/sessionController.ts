import type { Request, Response } from 'express';
import { CsmVersion } from '../models/CsmVersion.js';
import { Diagram } from '../models/Diagram.js';
import { Thread } from '../models/Thread.js';
import { notFound } from '../lib/httpError.js';

/**
 * The conversation so far: every prompt, and what each turn produced.
 *
 * Replaces the Python `/session-history` endpoint, which returned an
 * undifferentiated list of request and response entries the caller had to
 * re-pair by index.
 */
export async function getSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };

  const thread = await Thread.findOne({ sessionId });
  if (!thread) throw notFound(`No session ${sessionId}`);

  const diagrams = await Diagram.find({ sessionId }).select('version type valid carriedForward');
  const byVersion = new Map<number, { type: string; valid: boolean; carriedForward: boolean }[]>();
  for (const d of diagrams) {
    byVersion.set(d.version, [
      ...(byVersion.get(d.version) ?? []),
      { type: d.type, valid: d.valid, carriedForward: d.carriedForward },
    ]);
  }

  res.status(200).json({
    success: true,
    sessionId,
    brief: thread.brief,
    diagramTypes: thread.diagramTypes,
    currentVersion: thread.currentVersion,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    turns: thread.turns.map((turn) => ({
      version: turn.version,
      kind: turn.kind,
      prompt: turn.prompt,
      diagramTypes: turn.diagramTypes,
      at: turn.at,
      diagrams: byVersion.get(turn.version) ?? [],
    })),
  });
}

/**
 * Deletes the working state — thread, models, renders.
 *
 * Trajectories and feedback survive on purpose: they are the training set, and
 * clearing a chat is not a request to discard the ratings given in it.
 */
export async function deleteSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };

  const [thread, versions, diagrams] = await Promise.all([
    Thread.deleteOne({ sessionId }),
    CsmVersion.deleteMany({ sessionId }),
    Diagram.deleteMany({ sessionId }),
  ]);

  res.status(200).json({
    success: true,
    sessionId,
    deleted: {
      thread: thread.deletedCount,
      csmVersions: versions.deletedCount,
      diagrams: diagrams.deletedCount,
    },
    note: 'Feedback and LLM trajectories are retained for RL training.',
  });
}

/** The canonical model itself, for inspection and debugging. */
export async function getCanonicalModel(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params as { sessionId: string };
  const requested = req.query.version ? Number(req.query.version) : null;

  const stored = requested
    ? await CsmVersion.findOne({ sessionId, version: requested })
    : await CsmVersion.findOne({ sessionId }).sort({ version: -1 });

  if (!stored) throw notFound(`No canonical model for session ${sessionId}`);

  res.status(200).json({
    success: true,
    sessionId,
    version: stored.version,
    rationale: stored.rationale,
    integrity: stored.integrity,
    csm: stored.csm,
  });
}
