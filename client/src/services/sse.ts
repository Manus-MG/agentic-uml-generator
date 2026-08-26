import type { RunEvent } from '../types/uml';

/**
 * Reads the backend's SSE stream as an async iterable of run events.
 *
 * `EventSource` cannot issue a POST, and the generate endpoint needs a body, so
 * the stream is parsed off `fetch` by hand. The wire format is fixed and small
 * (`server/src/lib/sse.ts`): `event: <name>\ndata: <json>\n\n`, single-line
 * data, no `id:` and no `retry:`. Because the event name always duplicates the
 * payload's own `type` field, only the `data:` line needs parsing.
 *
 * Two things the server does not send, which callers must absorb:
 *  - No heartbeat. A slice call leaves the socket silent for tens of seconds,
 *    so silence is not a hang and must not be treated as one.
 *  - No terminal sentinel. The stream just closes; reader completion is the end.
 */
export async function* streamRun(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<RunEvent> {
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
  });

  // An error before the stream opens comes back as ordinary JSON, not as SSE.
  if (!res.ok) {
    const message = await errorMessage(res);
    yield { type: 'error', message, kind: null };
    return;
  }
  if (!res.body) {
    yield { type: 'error', message: 'The server returned an empty response body', kind: null };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line; the last chunk may be partial.
      let split = buffer.indexOf('\n\n');
      while (split !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const event = parseFrame(frame);
        if (event) yield event;
        split = buffer.indexOf('\n\n');
      }
    }

    const tail = parseFrame(buffer);
    if (tail) yield tail;
  } finally {
    // Aborting mid-run leaves the reader open; the server sees the disconnect
    // and stops writing, but the lock has to be released on this side.
    reader.cancel().catch(() => undefined);
  }
}

function parseFrame(frame: string): RunEvent | null {
  const trimmed = frame.trim();
  if (trimmed === '') return null;

  let name: string | null = null;
  const data: string[] = [];

  for (const line of trimmed.split('\n')) {
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (data.length === 0) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(data.join('\n'));
  } catch {
    return { type: 'error', message: `Unreadable event from the server: ${data.join('\n')}`, kind: null };
  }

  const record = payload as Record<string, unknown>;

  // The controller's own catch emits an error frame with no `type` field, so
  // the event name is the only thing identifying it.
  if (typeof record.type !== 'string') {
    if (name === 'error') {
      return {
        type: 'error',
        message: typeof record.message === 'string' ? record.message : 'Generation failed',
        kind: null,
      };
    }
    return null;
  }

  return record as unknown as RunEvent;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    if (typeof body.message === 'string') return body.message;
  } catch {
    /* not JSON — fall through to the status line */
  }
  return `Request failed (${res.status} ${res.statusText})`;
}
