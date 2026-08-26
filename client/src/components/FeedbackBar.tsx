import { useState } from 'react';
import { Check, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api } from '../services/api';
import type { DiagramPayload, Rating } from '../types/uml';

/**
 * Case 3 of the brief: a rating on one diagram, stored as the reward the ART
 * trainer reads back out of `/api/feedback/export`.
 *
 * The id sent is the diagram's own `diagramId`, which is a per-version Mongo
 * `_id` — rating "the sequence diagram" is meaningless without saying which
 * version of it.
 */
export function FeedbackBar({
  sessionId,
  diagram,
  known,
  onRated,
}: {
  sessionId: string;
  diagram: DiagramPayload;
  known?: { rating: Rating; comments: string | null };
  onRated?: (diagramId: string, value: { rating: Rating; comments: string | null }) => void;
}) {
  const [rating, setRating] = useState<Rating | null>(known?.rating ?? null);
  const [comments, setComments] = useState(known?.comments ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(known ? 'saved' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const disabled = !diagram.diagramId || state === 'saving';

  const submit = async (next: Rating) => {
    if (!diagram.diagramId) return;
    const trimmed = comments.trim() === '' ? null : comments.trim();
    setRating(next);
    setState('saving');
    setError(null);

    try {
      await api.submitFeedback({
        sessionId,
        diagramId: diagram.diagramId,
        rating: next,
        comments: trimmed,
      });
      setState('saved');
      onRated?.(diagram.diagramId, { rating: next, comments: trimmed });
    } catch (err) {
      setState('error');
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg-secondary/40 px-3 py-2">
      <span className="text-xs text-text-muted">Rate this diagram for the RL trainer:</span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => void submit('up')}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition disabled:opacity-40 ${
          rating === 'up'
            ? 'border-accent-emerald/60 bg-accent-emerald/15 text-accent-emerald'
            : 'border-line text-text-secondary hover:bg-bg-card-hover'
        }`}
      >
        <ThumbsUp size={13} /> Accurate <span className="text-text-muted">+1.0</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => void submit('down')}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition disabled:opacity-40 ${
          rating === 'down'
            ? 'border-accent-rose/60 bg-accent-rose/15 text-accent-rose'
            : 'border-line text-text-secondary hover:bg-bg-card-hover'
        }`}
      >
        <ThumbsDown size={13} /> Flawed <span className="text-text-muted">-1.0</span>
      </button>

      <input
        value={comments}
        onChange={(event) => setComments(event.target.value)}
        placeholder="What was wrong or right? (optional)"
        className="min-w-40 flex-1 rounded-md border border-line bg-bg-primary/60 px-2.5 py-1 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-line-active"
      />

      {state === 'saved' && (
        <span className="flex items-center gap-1 text-xs text-accent-emerald">
          <Check size={13} /> Saved
        </span>
      )}
      {state === 'error' && <span className="text-xs text-accent-rose">{error}</span>}
      {!diagram.diagramId && <span className="text-xs text-text-muted">not persisted yet</span>}
    </div>
  );
}
