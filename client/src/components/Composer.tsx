import { useEffect, useState } from 'react';
import {
  CaretDown,
  CaretUp,
  MagicWand,
  PaperPlaneRight,
  Sparkle,
  Stack,
  Stop,
} from '@phosphor-icons/react';
import { DiagramTypePicker } from './DiagramTypePicker';
import type { DiagramTypesResponse } from '../types/uml';

const QUICK_MODIFIERS = [
  'Add Redis Caching & Cache-Aside Pattern',
  'Add OAuth2 + JWT Auth Gateway with Token Revocation',
  'Include Async Event Bus / Kafka with Dead-Letter Queue',
  'Introduce Compliance Auditor & Immutable Audit Trail',
];

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

  useEffect(() => {
    if (isRevision) setShowTypes(false);
  }, [isRevision]);

  const submit = () => {
    const trimmed = prompt.trim();
    if (trimmed === '' || busy || disabled) return;
    onSend(trimmed);
    setPrompt('');
  };

  const applyModifier = (mod: string) => {
    setPrompt((prev) => (prev ? `${prev}\n\n• ${mod}` : `• ${mod}`));
  };

  return (
    <div className="border-t border-line bg-bg-secondary p-3.5">
      {/* Diagram Types Accordion Toggle */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowTypes((open) => !open)}
          className="flex items-center gap-1.5 rounded-md border border-line bg-bg-primary px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:border-line-hover hover:text-text-primary"
        >
          <Stack size={14} className="text-accent-indigo" />
          <span>Diagram Selection</span>
          <span className="rounded bg-accent-indigo/15 px-1.5 py-0.2 text-[10px] text-accent-indigo font-semibold">
            {selected.length === 0 ? 'Default (3)' : `${selected.length} types`}
          </span>
          {showTypes ? <CaretUp size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
        </button>

        {isRevision && (
          <div className="flex items-center gap-1 text-[11px] text-accent-cyan">
            <Sparkle size={13} weight="fill" />
            <span>Incremental AST Patch Mode</span>
          </div>
        )}
      </div>

      {/* Expandable Diagram Type Selector */}
      {showTypes && (
        <div className="mb-3 rounded-xl border border-line bg-bg-primary p-3.5 shadow-xl">
          <DiagramTypePicker catalogue={catalogue} selected={selected} onChange={onSelectedChange} />
        </div>
      )}

      {/* Quick Architecture Modifier Chips for Revisions */}
      {isRevision && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <MagicWand size={12} className="text-accent-indigo" /> Quick Modifiers:
          </span>
          {QUICK_MODIFIERS.map((mod) => (
            <button
              key={mod}
              type="button"
              onClick={() => applyModifier(mod)}
              className="rounded-md border border-line bg-bg-primary px-2 py-0.5 text-[10px] text-text-muted transition hover:border-accent-indigo/40 hover:bg-accent-indigo/10 hover:text-text-primary"
            >
              + {mod.split(' ')[1]} {mod.split(' ')[2] ?? ''}
            </button>
          ))}
        </div>
      )}

      {/* Textarea & Send Station */}
      <div className="relative flex items-end gap-2 rounded-xl border border-line bg-bg-primary p-2 transition focus-within:border-accent-indigo">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || !event.shiftKey)) {
              event.preventDefault();
              submit();
            }
          }}
          rows={3}
          disabled={disabled}
          placeholder={
            isRevision
              ? 'Describe what architectural slices to patch — e.g. "Add a compliance approver to the gap analysis flow and cache circulars in Redis"'
              : 'Describe the system architecture, components, workflows, or data domain you want modelled… [Enter to send]'
          }
          className="max-h-64 min-h-20 flex-1 resize-none bg-transparent p-2 text-xs font-sans leading-relaxed text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
        />

        <div className="flex flex-col items-end gap-1.5 pb-1 pr-1">
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 rounded-lg border border-accent-rose/50 bg-accent-rose/20 px-3.5 py-2 text-xs font-semibold text-accent-rose transition hover:bg-accent-rose/30"
            >
              <Stop size={14} weight="fill" className="fill-accent-rose" />
              <span>Stop Stream</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={disabled || prompt.trim() === ''}
              className="flex items-center gap-1.5 rounded-lg bg-accent-indigo px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-indigo-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
            >
              <PaperPlaneRight size={14} weight="bold" />
              <span>{isRevision ? 'Apply Patch' : 'Synthesize UML'}</span>
            </button>
          )}

          <div className="hidden items-center gap-1 text-[10px] text-text-muted sm:flex">
            <kbd className="rounded border border-line bg-bg-secondary px-1 py-0.2 font-mono text-[9px]">
              ↵ Send
            </kbd>
            <span className="text-line">|</span>
            <kbd className="rounded border border-line bg-bg-secondary px-1 py-0.2 font-mono text-[9px]">
              ⇧+↵ Newline
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
