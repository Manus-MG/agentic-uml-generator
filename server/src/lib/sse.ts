import type { Response } from 'express';

/**
 * Server-sent events, written by hand.
 *
 * A generation turn takes tens of seconds — several LLM calls and a JVM per
 * diagram — and the brief asks for latency to be minimised. It cannot be made
 * short, so it is made visible: the client sees each phase as it starts and
 * each diagram's source as it is projected, well before its PNG exists.
 */
export class SseStream {
  private open = true;

  constructor(private readonly res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tells nginx and friends not to buffer, which would defeat the point.
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    // A client that navigates away should stop the run, not keep paying for it.
    res.on('close', () => {
      this.open = false;
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  send(event: string, data: unknown): void {
    if (!this.open) return;
    this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  end(): void {
    if (!this.open) return;
    this.open = false;
    this.res.end();
  }
}

/** True when the caller asked for a stream rather than a single JSON response. */
export function wantsSse(accept: string | undefined): boolean {
  return typeof accept === 'string' && accept.includes('text/event-stream');
}
