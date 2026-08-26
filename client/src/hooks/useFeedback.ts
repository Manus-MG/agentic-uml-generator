import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { FeedbackEntry, Rating } from '../types/uml';

export interface KnownRating {
  rating: Rating;
  comments: string | null;
}

/**
 * The ratings this session already carries, keyed by diagram id.
 *
 * Loaded once per session so a reload shows what was rated instead of inviting
 * the user to rate the same diagram again.
 */
export function useFeedback(sessionId: string | null) {
  const [known, setKnown] = useState<Map<string, KnownRating>>(new Map());

  useEffect(() => {
    setKnown(new Map());
    if (!sessionId) return;
    let cancelled = false;

    api
      .listFeedback(sessionId)
      .then((data) => {
        if (cancelled) return;
        setKnown(
          new Map(
            data.feedback.map((entry: FeedbackEntry) => [
              entry.diagramId,
              { rating: entry.rating, comments: entry.comments },
            ]),
          ),
        );
      })
      .catch(() => {
        // A session with no ratings yet is the common case, not a failure.
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const record = useCallback((diagramId: string, value: KnownRating) => {
    setKnown((current) => new Map(current).set(diagramId, value));
  }, []);

  return { known, record };
}
