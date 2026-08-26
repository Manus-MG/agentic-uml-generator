import type { Request, Response } from 'express';
import { Feedback } from '../models/Feedback.js';
import { Trajectory } from '../models/Trajectory.js';

interface SignalSummary {
  signal: string;
  reward: number;
  confidence: number;
  evidence: unknown;
}

/**
 * The RL training set, as JSONL.
 *
 * One line per LLM call that has a signal attached, in the shape an ART/GRPO
 * trainer consumes: the exact messages sent, the exact completion returned,
 * and a scalar reward. Streamed rather than assembled in memory — this
 * collection only grows.
 *
 * Every `Feedback` row here was written automatically by the pipeline — see
 * `server/src/agent/implicitSignals.ts` — never submitted by a user. A
 * diagram can carry more than one signal (e.g. it rendered cleanly *and* later
 * got reworked by a revision), so they are combined per diagram before being
 * applied to a turn's reward, not averaged as separate ratings.
 *
 * A turn's reward is the mean of its diagrams' combined rewards, because the
 * calls that build the canonical model are shared by every diagram in the
 * turn: one negative diagram out of five is weak evidence against the model,
 * not a verdict on it. A call tagged with a specific diagram type is scored by
 * that diagram's own combined reward alone.
 */
export async function exportFeedback(req: Request, res: Response): Promise<void> {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : null;
  const filter = sessionId ? { sessionId } : {};

  const feedback = await Feedback.find(filter);
  if (feedback.length === 0) {
    res.status(200).type('application/x-ndjson').send('');
    return;
  }

  // (sessionId, version, type) -> every signal recorded for that diagram
  const diagramSignals = new Map<string, SignalSummary[]>();
  for (const f of feedback) {
    const key = `${f.sessionId}::${f.version}::${f.diagramType}`;
    diagramSignals.set(key, [
      ...(diagramSignals.get(key) ?? []),
      { signal: f.signal, reward: f.reward, confidence: f.confidence, evidence: f.evidence },
    ]);
  }

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  // (sessionId, version, type) -> combined reward, and (sessionId, version) -> combined rewards
  const diagramRewards = new Map<string, number>();
  const turnRewards = new Map<string, number[]>();
  for (const [key, signals] of diagramSignals) {
    const combined = clamp(
      signals.reduce((sum, s) => sum + s.reward * s.confidence, 0),
      -1,
      1,
    );
    diagramRewards.set(key, combined);
    const turnKey = key.slice(0, key.lastIndexOf('::'));
    turnRewards.set(turnKey, [...(turnRewards.get(turnKey) ?? []), combined]);
  }

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

    if (reward === undefined) continue; // no automatic signal yet — nothing to learn from

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
          // from, so their reward is a mean across those diagrams' combined
          // signals, not a single diagram's verdict.
          rewardBasis: shared ? 'turn-mean' : 'diagram',
          signals: shared
            ? null
            : (diagramSignals.get(`${turnKey}::${t.diagramType}`) ?? []).map((s) => ({
                signal: s.signal,
                reward: s.reward,
                confidence: s.confidence,
                evidence: s.evidence,
              })),
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
