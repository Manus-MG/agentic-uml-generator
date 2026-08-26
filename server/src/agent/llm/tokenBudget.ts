/**
 * A rolling per-minute token budget.
 *
 * Groq enforces tokens-per-minute, not just requests-per-minute, and — this is
 * the part that surprises people — `max_completion_tokens` counts toward the
 * *request* size. So a request is rejected with a 413 before the model runs if
 * `prompt + max_completion_tokens` exceeds the limit, and retrying it verbatim
 * can never succeed.
 *
 * On the free tier the ceiling is 8,000 TPM, which a naive implementation burns
 * through in two calls and then spends the rest of the run backing off. Pacing
 * locally is both faster and cheaper than discovering the limit by being
 * rejected: we reserve an estimate before sending, reconcile against the actual
 * usage afterwards, and trust the server's own headers over our estimate
 * whenever it tells us where we stand.
 */
export class TokenBudget {
  private readonly window = 60_000;
  private spent: { at: number; tokens: number }[] = [];
  private limit: number;
  /** Set from x-ratelimit headers; more authoritative than our local tally. */
  private serverRemaining: number | null = null;
  private serverResetAt = 0;

  constructor(limit = 8000) {
    this.limit = limit;
  }

  setLimit(limit: number): void {
    if (Number.isFinite(limit) && limit > 0) this.limit = limit;
  }

  getLimit(): number {
    return this.limit;
  }

  private prune(now: number): void {
    const cutoff = now - this.window;
    this.spent = this.spent.filter((entry) => entry.at > cutoff);
  }

  private localUsed(now: number): number {
    this.prune(now);
    return this.spent.reduce((sum, entry) => sum + entry.tokens, 0);
  }

  remaining(now = Date.now()): number {
    if (this.serverRemaining !== null && now < this.serverResetAt + this.window) {
      return Math.min(this.serverRemaining, this.limit - this.localUsed(now));
    }
    return this.limit - this.localUsed(now);
  }

  /**
   * A request larger than the whole per-minute budget can never succeed.
   * Callers should surface this as a configuration error, not retry it.
   */
  exceedsLimit(estimate: number): boolean {
    return estimate > this.limit;
  }

  /** Milliseconds until `estimate` tokens are affordable. */
  waitFor(estimate: number, now = Date.now()): number {
    if (this.remaining(now) >= estimate) return 0;
    this.prune(now);
    if (this.spent.length === 0) return 0;
    // Wait until the oldest entries age out of the window.
    let freed = 0;
    const needed = estimate - this.remaining(now);
    for (const entry of this.spent) {
      freed += entry.tokens;
      if (freed >= needed) {
        return Math.max(0, entry.at + this.window - now) + 50;
      }
    }
    return Math.max(0, this.spent[this.spent.length - 1]!.at + this.window - now) + 50;
  }

  reserve(estimate: number, now = Date.now()): void {
    this.spent.push({ at: now, tokens: estimate });
  }

  /** Replaces a reservation with what the call actually cost. */
  reconcile(estimate: number, actual: number, now = Date.now()): void {
    const index = this.spent.findIndex((entry) => entry.tokens === estimate);
    if (index !== -1) this.spent[index] = { at: this.spent[index]!.at, tokens: actual };
    else this.spent.push({ at: now, tokens: actual });
  }

  /** Adopts the server's own accounting when it reports it. */
  observeHeaders(headers: Headers | undefined): void {
    if (!headers) return;
    const limit = Number.parseInt(headers.get('x-ratelimit-limit-tokens') ?? '', 10);
    if (Number.isFinite(limit)) this.setLimit(limit);

    const remaining = Number.parseInt(headers.get('x-ratelimit-remaining-tokens') ?? '', 10);
    if (Number.isFinite(remaining)) {
      this.serverRemaining = remaining;
      this.serverResetAt = Date.now();
    }
  }

  /** Test seam. */
  reset(): void {
    this.spent = [];
    this.serverRemaining = null;
    this.serverResetAt = 0;
  }
}

/**
 * Rough token estimate. Deliberately conservative: under-estimating causes a
 * 413, over-estimating only costs a little pacing.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

export const sharedBudget = new TokenBudget();
