import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Send, Square } from 'lucide-react';
import { DiagramTypePicker } from './DiagramTypePicker';
import type { DiagramTypesResponse } from '../types/uml';

/**
 * The prompt box.
 *
 * The same control serves both a first prompt and a follow-up revision — the
 * backend decides which it is from whether the session already has a model, so
 * the only thing that changes here is the label.
 */
export function Composer({
  catalogue,
  selected,
  onSelectedChange,
  onSend,
  onStop,
  busy,
  isRevision,
  disabled,
}: {
  catalogue: DiagramTypesResponse | null;
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  onSend: (prompt: string) => void;
  onStop: () => void;
  busy: boolean;
  isRevision: boolean;
  disabled: boolean;
}) {
  const [prompt, setPrompt] = useState('');
  const [showTypes, setShowTypes] = useState(!isRevision);

  // Once a session has a model the picker is rarely the point — a follow-up is
  // usually a sentence, not a re-pick. It stays reopenable.
  useEffect(() => {
    if (isRevision) setShowTypes(false);
  }, [isRevision]);

  const submit = () => {
    const trimmed = prompt.trim();
    if (trimmed === '' || busy || disabled) return;
    onSend(trimmed);
    setPrompt('');
  };

  return (
    <div className="border-t border-line bg-bg-secondary/60 p-3 backdrop-blur">
      <button
        type="button"
        onClick={() => setShowTypes((open) => !open)}
        className="mb-2 flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
      >
        {showTypes ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        Diagram types
        <span className="text-text-muted">
          {selected.length === 0
            ? isRevision
              ? '(keeping this session’s existing set)'
              : '(defaults to sequence, component, class)'
            : `(${selected.length} selected)`}
        </span>
      </button>

      {showTypes && (
        <div className="mb-3 rounded-lg border border-line bg-bg-primary/40 p-3">
          <DiagramTypePicker catalogue={catalogue} selected={selected} onChange={onSelectedChange} />
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline, as briefs are multi-line.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={3}
          disabled={disabled}
          placeholder={
            isRevision
              ? 'Describe what should change — e.g. "Add a compliance officer who approves the gap analysis"'
              : 'Describe the system you want modelled…'
          }
          className="max-h-60 min-h-20 flex-1 resize-y rounded-lg border border-line bg-bg-primary/60 p-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-line-active disabled:opacity-50"
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-2 rounded-lg border border-accent-rose/50 bg-accent-rose/10 px-4 py-3 text-sm font-medium text-accent-rose transition hover:bg-accent-rose/20"
          >
            <Square size={15} /> Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || prompt.trim() === ''}
            className="flex items-center gap-2 rounded-lg bg-linear-to-br from-accent-indigo to-accent-violet px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={15} /> {isRevision ? 'Revise' : 'Generate'}
          </button>
        )}
      </div>
    </div>
  );
}
