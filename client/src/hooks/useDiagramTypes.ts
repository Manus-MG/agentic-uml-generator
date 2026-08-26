import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DiagramTypesResponse, UMLModel } from '../types/uml';

/**
 * The diagram catalogue, fetched once.
 *
 * It is the only source of display names: a `DiagramPayload.name` is just the
 * canonical id repeated, so "state-machine" would otherwise be the label.
 */
export function useDiagramTypes() {
  const [catalogue, setCatalogue] = useState<DiagramTypesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .getDiagramTypes()
      .then((data) => {
        if (!cancelled) setCatalogue(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useCallback(
    (id: string): UMLModel | undefined => catalogue?.data.find((model) => model.id === id),
    [catalogue],
  );

  const displayName = useCallback((id: string) => byId(id)?.name ?? id, [byId]);

  return { catalogue, loading, error, byId, displayName };
}
