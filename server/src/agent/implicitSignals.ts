/**
 * Reward/confidence formulas for the automatic feedback signals the pipeline
 * records. Pure functions, no I/O — the DB writes live in `pipeline.ts`
 * (`server/src/models/Feedback.ts`), this module is just the math, kept in one
 * documented place instead of scattered magic numbers.
 *
 * All three signals share a scale with the reward the old thumbs widget used
 * to write directly (+1.0 / -1.0): none of them alone should be able to reach
 * that magnitude, since no single automatic signal is as strong evidence as a
 * human explicitly saying so.
 */

export interface SignalResult {
  reward: number;
  confidence: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Whether a diagram rendered cleanly. Purely mechanical — no user involved.
 * - invalid: the repair loop gave up. Strong, certain negative signal.
 * - valid but repaired: it got there, but the model needed help. Weak negative.
 * - valid and clean: the common case, weak positive (most diagrams render clean
 *   on the first try, so this alone shouldn't dominate).
 */
export function renderQualitySignal(valid: boolean, repairAttempts: number): SignalResult {
  if (!valid) return { reward: -0.4, confidence: 1.0 };
  if (repairAttempts > 0) return { reward: -Math.min(0.2, 0.05 * repairAttempts), confidence: 0.6 };
  return { reward: 0.1, confidence: 0.3 };
}

/**
 * A revision touched this diagram's slices — the user asked for a change that
 * lands on content this diagram was built from. `touchedIds` is how many
 * elements the patch actually added/replaced/removed (breadth of the rework);
 * `latencyMs` is how long it had been since the previous turn (speed of the
 * complaint). A big, fast correction is stronger evidence the prior diagram
 * was wrong than a small edit made an hour later.
 */
export function revisionReworkSignal(touchedIdsCount: number, latencyMs: number): SignalResult {
  const breadth = 1 - Math.exp(-touchedIdsCount / 3);
  const speed = clamp(1 - latencyMs / (15 * 60 * 1000), 0.3, 1.0);
  return { reward: -0.5 * breadth * speed, confidence: breadth * speed };
}

/**
 * A diagram type rode `carriedForward` through another `streak` revisions in a
 * row — the user kept changing other things and never asked to touch this
 * one. Diminishing returns (log2), capped below what a single explicit
 * complaint could outweigh, and confidence grows with the streak: surviving
 * one revision is weak evidence, surviving five is much stronger.
 */
export function survivedCarryForwardSignal(streak: number): SignalResult {
  return { reward: Math.min(0.4, 0.2 * Math.log2(1 + streak)), confidence: Math.min(1, streak / 5) };
}
