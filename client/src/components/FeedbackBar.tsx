import { useState } from 'react';
import {
  Check,
  CircleNotch,
  Sparkle,
  ThumbsDown,
  ThumbsUp,
} from '@phosphor-icons/react';
import { api } from '../services/api';
import type { DiagramPayload, Rating } from '../types/uml';

const QUICK_TAGS_UP = [
  'Accurate Flow',
  'Clean Abstraction',
  'Precise Multiplicity',
  'Great Decomposition',
];

const QUICK_TAGS_DOWN = [
  'Missing Lifeline',
  'Wrong Cardinality',
  'Syntax Flaw',
  'Vague Interfaces',
  'Incorrect Layering',
];

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

  const submit = async (next: Rating, commentText?: string) => {
    if (!diagram.diagramId) return;
    const finalComment = commentText !== undefined ? commentText : comments;
    const trimmed = finalComment.trim() === '' ? null : finalComment.trim();
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

  const addTag = (tagText: string) => {
    const nextComment = comments ? `${comments} | ${tagText}` : tagText;
    setComments(nextComment);
    if (rating) {
      void submit(rating, nextComment);
    }
  };

  const activeTags = rating === 'down' ? QUICK_TAGS_DOWN : QUICK_TAGS_UP;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg-primary p-3 shadow-inner">
      {/* Header and Rating Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <Sparkle size={14} weight="fill" className="text-accent-indigo" />
          <span className="font-medium text-text-primary">RLHF Trainer Feedback:</span>
          <span className="hidden text-text-muted sm:inline">(feeder for LangChain ART agent)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void submit('up')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
              rating === 'up'
                ? 'border-accent-emerald bg-accent-emerald/20 text-accent-emerald ring-1 ring-accent-emerald/40'
                : 'border-line bg-bg-secondary text-text-secondary hover:border-accent-emerald/40 hover:bg-accent-emerald/10 hover:text-accent-emerald'
            } disabled:opacity-40`}
          >
            <ThumbsUp size={14} weight={rating === 'up' ? 'fill' : 'regular'} />
            <span>Accurate</span>
            <span className="rounded bg-accent-emerald/20 px-1 py-0.2 text-[10px] text-accent-emerald font-mono">
              +1.0
            </span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => void submit('down')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
              rating === 'down'
                ? 'border-accent-rose bg-accent-rose/20 text-accent-rose ring-1 ring-accent-rose/40'
                : 'border-line bg-bg-secondary text-text-secondary hover:border-accent-rose/40 hover:bg-accent-rose/10 hover:text-accent-rose'
            } disabled:opacity-40`}
          >
            <ThumbsDown size={14} weight={rating === 'down' ? 'fill' : 'regular'} />
            <span>Flawed</span>
            <span className="rounded bg-accent-rose/20 px-1 py-0.2 text-[10px] text-accent-rose font-mono">
              -1.0
            </span>
          </button>
        </div>
      </div>

      {/* Quick Tag Pills */}
      {rating && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-text-muted">Quick tag:</span>
          {activeTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="rounded-md border border-line bg-bg-secondary px-2 py-0.5 text-[10px] text-text-secondary transition hover:border-accent-indigo/40 hover:bg-accent-indigo/10 hover:text-text-primary"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}

      {/* Comment Input and Submit Status */}
      <div className="flex items-center gap-2">
        <input
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && rating) {
              void submit(rating);
            }
          }}
          placeholder="Detailed critique or architectural reason (optional)…"
          className="flex-1 rounded-lg border border-line bg-bg-secondary px-3 py-1.5 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent-indigo"
        />

        {rating && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void submit(rating)}
            className="rounded-lg bg-accent-indigo px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-indigo-hover"
          >
            Save Note
          </button>
        )}

        {state === 'saving' && (
          <span className="flex items-center gap-1 text-xs text-accent-indigo">
            <CircleNotch size={12} className="animate-spin" /> saving…
          </span>
        )}

        {state === 'saved' && (
          <span className="flex items-center gap-1 text-xs font-medium text-accent-emerald">
            <Check size={13} weight="bold" /> Recorded
          </span>
        )}

        {state === 'error' && <span className="text-xs text-accent-rose">{error}</span>}
      </div>
    </div>
  );
}
