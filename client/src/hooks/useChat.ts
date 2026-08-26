import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { DiagramPayload, DoneEvent, SessionResponse } from '../types/uml';

export interface Phase {
  phase: string;
  detail: string | null;
  at: number;
}

/** One exchange: the prompt sent, and everything the backend produced for it. */
export interface Turn {
  id: string;
  prompt: string;
  requestedTypes: string[];
  status: 'streaming' | 'complete' | 'error';
  phases: Phase[];
  /** Keyed by diagram type, so the 'rendered' event replaces the 'projected' one. */
  diagrams: Map<string, DiagramPayload>;
  done: DoneEvent | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  /** Set for turns rebuilt from session history rather than streamed live. */
  version: number | null;
  kind: 'generate' | 'revise' | null;
}

function emptyTurn(prompt: string, requestedTypes: string[]): Turn {
  return {
    id: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    prompt,
    requestedTypes,
    status: 'streaming',
    phases: [],
    diagrams: new Map(),
    done: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
    version: null,
    kind: null,
  };
}

/**
 * The chat for one session.
 *
 * The three cases in the brief all land here. A new session's first send is a
 * generate; a later send on the same session is a revision, and the backend
 * decides that on its own — the client sends the same request either way and
 * reads `done.mode` to label what happened.
 */
export function useChat(sessionId: string | null, userId?: string | null) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patchTurn = useCallback((turnId: string, apply: (turn: Turn) => Turn) => {
    setTurns((current) => current.map((turn) => (turn.id === turnId ? apply(turn) : turn)));
  }, []);

  /* ---------------------------------------------------------- rehydration */

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setTurns([]);
    setLoadError(null);

    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      let history: SessionResponse;
      try {
        history = await api.getSession(sessionId);
      } catch {
        // A session with no turns yet — a brand new chat — is not an error.
        return;
      }
      if (cancelled) return;

      // The diagrams of every past version, so scrolling back shows real images
      // and not just the metadata the history endpoint carries.
      const rendered = await Promise.all(
        history.turns.map((turn) =>
          api
            .listDiagrams(sessionId, turn.version)
            .then((res) => res.diagrams)
            .catch(() => [] as DiagramPayload[]),
        ),
      );
      if (cancelled) return;

      setTurns(
        history.turns.map((turn, index) => ({
          ...emptyTurn(turn.prompt, turn.diagramTypes),
          id: `turn_v${turn.version}`,
          status: 'complete' as const,
          diagrams: new Map(rendered[index].map((d) => [d.type, d])),
          startedAt: new Date(turn.at).getTime(),
          finishedAt: new Date(turn.at).getTime(),
          version: turn.version,
          kind: turn.kind,
        })),
      );
    })().catch((err: Error) => {
      if (!cancelled) setLoadError(err.message);
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /* --------------------------------------------------------------- sending */

  const send = useCallback(
    async (prompt: string, diagramTypes: string[]) => {
      if (!sessionId || busy) return;

      const turn = emptyTurn(prompt, diagramTypes);
      setTurns((current) => [...current, turn]);
      setBusy(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const body = {
          prompt,
          ...(diagramTypes.length > 0 ? { diagram_types: diagramTypes } : {}),
          ...(userId ? { userId } : {}),
        };

        for await (const event of api.streamGenerate(sessionId, body, controller.signal)) {
          switch (event.type) {
            case 'phase':
              patchTurn(turn.id, (t) => ({
                ...t,
                phases: [...t.phases, { phase: event.phase, detail: event.detail, at: Date.now() }],
              }));
              break;

            case 'diagram':
              // Each diagram arrives twice: 'projected' (source only, valid
              // null) then 'rendered'. Keying by type makes the second an
              // upgrade of the first rather than a duplicate tab.
              patchTurn(turn.id, (t) => {
                const diagrams = new Map(t.diagrams);
                diagrams.set(event.diagram.type, event.diagram);
                return { ...t, diagrams };
              });
              break;

            case 'done':
              patchTurn(turn.id, (t) => ({
                ...t,
                status: 'complete',
                done: event,
                version: event.version,
                kind: event.mode,
                finishedAt: Date.now(),
              }));
              break;

            case 'error':
              patchTurn(turn.id, (t) => ({
                ...t,
                status: 'error',
                error: event.message,
                finishedAt: Date.now(),
              }));
              break;
          }
        }

        // The stream closes with no sentinel, so a turn still marked streaming
        // here means it ended without a `done` — an abort, or a dropped socket.
        patchTurn(turn.id, (t) =>
          t.status !== 'streaming'
            ? t
            : {
                ...t,
                status: controller.signal.aborted ? 'complete' : 'error',
                error: controller.signal.aborted ? null : 'The connection closed before the run finished',
                finishedAt: Date.now(),
              },
        );
      } catch (err) {
        const aborted = controller.signal.aborted;
        patchTurn(turn.id, (t) => ({
          ...t,
          status: aborted ? 'complete' : 'error',
          error: aborted ? null : (err as Error).message,
          finishedAt: Date.now(),
        }));
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [sessionId, userId, busy, patchTurn],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * A different view of the model this session already holds.
   *
   * Folded into the latest turn, because that is where its siblings are — and
   * it does not create a version, so it is not a turn of its own.
   */
  const addView = useCallback(
    async (diagramType: string) => {
      if (!sessionId) return;
      const result = await api.switchView(sessionId, diagramType);

      setTurns((current) => {
        if (current.length === 0) return current;
        const last = current[current.length - 1];
        const diagrams = new Map(last.diagrams);
        diagrams.set(result.diagram.type, result.diagram);
        return [...current.slice(0, -1), { ...last, diagrams }];
      });

      return result;
    },
    [sessionId],
  );

  /** Replaces one diagram in place, e.g. after a feedback round trip. */
  const patchDiagram = useCallback((turnId: string, diagram: DiagramPayload) => {
    setTurns((current) =>
      current.map((turn) => {
        if (turn.id !== turnId) return turn;
        const diagrams = new Map(turn.diagrams);
        diagrams.set(diagram.type, diagram);
        return { ...turn, diagrams };
      }),
    );
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { turns, busy, loadError, send, stop, addView, patchDiagram };
}
