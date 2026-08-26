import type { Request, Response } from 'express';
import { z } from 'zod';
import { Diagram } from '../models/Diagram.js';
import { Feedback } from '../models/Feedback.js';
import { Trajectory } from '../models/Trajectory.js';
import { badRequest, notFound } from '../lib/httpError.js';

/** `thumbs_up`/`thumbs_down` are the Python spellings; both are accepted. */
const FeedbackBody = z
  .object({
    sessionId: z.string().min(1).optional(),
    session_id: z.string().min(1).optional(),
    diagramId: z.string().min(1),
    rating: z.enum(['up', 'down', 'thumbs_up', 'thumbs_down']),
    comments: z.string().nullish(),
  })
  .transform((body, ctx) => {
    const sessionId = body.sessionId ?? body.session_id;
    if (!sessionId) {
      ctx.addIssue({ code: 'custom', message: 'sessionId is required' });
      return z.NEVER;
    }
    return {
      sessionId,
      diagramId: body.diagramId,
      rating: body.rating === 'thumbs_up' ? 'up' : body.rating === 'thumbs_down' ? 'down' : body.rating,
      comments: body.comments ?? null,
    };
  });

/**
 * Records a rating against one diagram.
 *
 * The diagram is looked up rather than trusted, so a rating always points at a
 * real render and carries the version and type needed to join it to the
 * trajectories that produced it.
 *
 * Re-rating the same diagram replaces the previous rating instead of appending
 * a contradictory second one.
 */
export async function submitFeedback(req: Request, res: Response): Promise<void> {
  const result = FeedbackBody.safeParse(req.body ?? {});
  if (!result.success) {
    throw badRequest('Invalid feedback body', result.error.issues.map((i) => i.message));
  }
  const body = result.data;

  const diagram = await Diagram.findById(body.diagramId).catch(() => null);
  if (!diagram || diagram.sessionId !== body.sessionId) {
    throw notFound(`No diagram ${body.diagramId} in session ${body.sessionId}`);
  }

  const feedback = await Feedback.findOneAndUpdate(
    { sessionId: body.sessionId, diagramId: diagram._id },
    {
      $set: {
        version: diagram.version,
        diagramType: diagram.type,
        rating: body.rating,
        reward: body.rating === 'up' ? 1.0 : -1.0,
        comments: body.comments,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );

  res.status(200).json({
    success: true,
    feedbackId: String(feedback._id),
    sessionId: body.sessionId,
    diagramType: diagram.type,
    version: diagram.version,
    reward: feedback.reward,
  });
}

/**
 * The RL training set, as JSONL.
 *
 * One line per LLM call that has a rating attached, in the shape an ART/GRPO
 * trainer consumes: the exact messages sent, the exact completion returned, and
 * a scalar reward. Streamed rather than assembled in memory — this collection
 * only grows.
 *
 * A turn's reward is the mean of the ratings given to the diagrams it produced,
 * because the calls that build the canonical model are shared by every diagram
 * in the turn: one thumbs-down out of five diagrams is weak evidence against
 * the model, not a verdict on it. A call tagged with a specific diagram type is
 * scored by that diagram's own rating alone.
 */
export async function exportFeedback(req: Request, res: Response): Promise<void> {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : null;
  const filter = sessionId ? { sessionId } : {};

  const feedback = await Feedback.find(filter);
  if (feedback.length === 0) {
    res.status(200).type('application/x-ndjson').send('');
    return;
  }

  // (sessionId, version) -> rewards, and (sessionId, version, type) -> reward
  const turnRewards = new Map<string, number[]>();
  const diagramRewards = new Map<string, number>();
  for (const f of feedback) {
    const turnKey = `${f.sessionId}::${f.version}`;
    turnRewards.set(turnKey, [...(turnRewards.get(turnKey) ?? []), f.reward]);
    diagramRewards.set(`${turnKey}::${f.diagramType}`, f.reward);
  }

  /** How the turn's mean was arrived at — one up and one down also averages to 0. */
  const breakdown = (values: number[] | undefined) => {
    if (!values) return null;
    return {
      up: values.filter((v) => v > 0).length,
      down: values.filter((v) => v < 0).length,
      rated: values.length,
    };
  };

  res.status(200).type('application/x-ndjson');
  res.setHeader('Content-Disposition', 'attachment; filename="rl_training_data.jsonl"');

  const cursor = Trajectory.find(filter).sort({ sessionId: 1, version: 1, createdAt: 1 }).cursor();
  let written = 0;

  for await (const t of cursor) {
    const turnKey = `${t.sessionId}::${t.version}`;
    const shared = !t.diagramType;
    const reward = shared
      ? average(turnRewards.get(turnKey))
      : diagramRewards.get(`${turnKey}::${t.diagramType}`);

    if (reward === undefined) continue; // unrated turn — nothing to learn from

    res.write(
      `${JSON.stringify({
        messages: t.messages,
        completion: t.completion,
        reward,
        metadata: {
          sessionId: t.sessionId,
          version: t.version,
          step: t.step,
          diagramType: t.diagramType,
          model: t.model,
          // Shared calls build the model every diagram in the turn is projected
          // from, so their reward is a mean. Without the breakdown a 0 from one
          // up and one down is indistinguishable from a 0 meaning "no signal".
          rewardBasis: shared ? 'turn-mean' : 'diagram',
          ratings: shared ? breakdown(turnRewards.get(turnKey)) : null,
          usage: t.usage,
          durationMs: t.durationMs,
          reasoning: t.reasoning,
          at: t.createdAt,
        },
      })}\n`,
    );
    written += 1;
  }

  if (written === 0) res.write('');
  res.end();
}

function average(values: number[] | undefined): number | undefined {
  if (!values || values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
