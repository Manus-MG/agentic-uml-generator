import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { SessionSummary } from '../types/uml';

const ACTIVE_KEY = 'uml_session_id';

/** Session ids are client-minted and carry no authority — they are just keys. */
export function newSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * The session list, owned by the backend.
 *
 * `Thread` carries a 24h TTL, so a session that has expired is absent from the
 * list rather than a dead row — which is why this is not built from
 * localStorage. Only the *active* id is remembered locally, so a reload returns
 * to the chat you were in.
 */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listSessions();
      setSessions(data.sessions);
      return data.sessions;
    } catch {
      // A backend that is down should not blank the sidebar mid-session.
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* private browsing; the list still works, it just will not persist */
    }
  }, [activeId]);

  /**
   * A new chat is only an id until its first turn — nothing is written to the
   * backend, so it deliberately does not appear in the sidebar yet.
   */
  const startNew = useCallback(() => {
    const id = newSessionId();
    setActiveId(id);
    return id;
  }, []);

  const remove = useCallback(
    async (sessionId: string) => {
      await api.deleteSession(sessionId);
      setSessions((current) => current.filter((s) => s.sessionId !== sessionId));
      setActiveId((current) => (current === sessionId ? null : current));
    },
    [],
  );

  return { sessions, activeId, setActiveId, startNew, remove, refresh, loading };
}
