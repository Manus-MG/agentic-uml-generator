import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { BackendHealthResponse } from '../types/uml';

export type HealthStatus = 'checking' | 'ok' | 'degraded' | 'unreachable';

/**
 * Backend readiness.
 *
 * Worth surfacing because two of the three dependencies fail quietly from the
 * user's side: a missing JVM or an unset Groq key only shows up as a failed run
 * minutes later.
 */
export function useHealth() {
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);
  const [status, setStatus] = useState<HealthStatus>('checking');

  const refresh = useCallback(async () => {
    setStatus('checking');
    try {
      const data = await api.checkHealth();
      setHealth(data);
      setStatus(data.status === 'ok' ? 'ok' : 'degraded');
    } catch {
      setHealth(null);
      setStatus('unreachable');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { health, status, refresh };
}
