import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { CanonicalModelResponse } from '../types/uml';

/**
 * The canonical model behind the diagrams.
 *
 * Worth exposing: it is the reason the views agree with each other, and reading
 * it is the fastest way to tell a bad projection from a bad model.
 */
export function ModelDrawer({ sessionId, version }: { sessionId: string; version: number | null }) {
  const [model, setModel] = useState<CanonicalModelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setModel(null);
    setError(null);

    api
      .getCanonicalModel(sessionId, version ?? undefined)
      .then((data) => {
        if (!cancelled) setModel(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, version]);

  if (error) return <p className="p-4 text-xs text-accent-rose">{error}</p>;
  if (!model) return <p className="p-4 text-xs text-text-muted">Loading canonical model…</p>;

  return (
    <div className="space-y-2">
      {model.rationale && <p className="text-xs text-text-secondary">{model.rationale}</p>}
      <pre className="overflow-x-auto rounded-lg border border-line bg-bg-primary/60 p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
        {JSON.stringify(model.csm, null, 2)}
      </pre>
    </div>
  );
}
