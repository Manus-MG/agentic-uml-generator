import { useState } from 'react';
import {
  Check,
  Copy,
  GitBranch,
  Sparkle,
  User,
  WarningCircle,
} from '@phosphor-icons/react';
import { DiagramTabs } from './DiagramTabs';
import { IntegrityPanel } from './IntegrityPanel';
import { PhaseTrail } from './PhaseTrail';
import type { Turn } from '../hooks/useChat';

export function ChatTurn({
  turn,
  isActive,
  activeType,
  onSelectDiagram,
  displayName,
}: {
  turn: Turn;
  isActive: boolean;
  activeType: string | null;
  onSelectDiagram: (turnId: string, type: string) => void;
  displayName: (id: string) => string;
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const diagrams = [...turn.diagrams.values()];

  const copyPromptText = () => {
    navigator.clipboard.writeText(turn.prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const label =
    turn.status === 'streaming'
      ? 'Synthesizing Architecture…'
      : turn.kind === 'revise'
        ? `Revision Patch → v${turn.version}`
        : turn.version !== null
          ? `Synthesized Specification v${turn.version}`
          : 'Stopped';

  return (
    <div className="flex flex-col gap-3.5">
      {/* User Prompt Message Bubble */}
      <div className="group flex justify-end">
        <div className="relative flex max-w-3xl flex-col gap-1.5 rounded-2xl rounded-tr-sm border border-line-hover bg-bg-card p-3.5 shadow-md">
          <div className="flex items-center justify-between gap-4 border-b border-line/60 pb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
              <div className="flex size-4.5 items-center justify-center rounded-full bg-bg-tertiary text-text-muted">
                <User size={11} weight="bold" />
              </div>
              <span>Architectural Prompt</span>
            </div>

            <button
              type="button"
              onClick={copyPromptText}
              title="Copy prompt text"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
            >
              {copiedPrompt ? <Check size={11} weight="bold" className="text-accent-emerald" /> : <Copy size={11} />}
              <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <p className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-text-primary">
            {turn.prompt}
          </p>
        </div>
      </div>

      {/* Assistant Response Card */}
      <div className="flex items-start gap-3">
        {/* Agent Avatar Badge */}
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent-indigo text-white shadow-md">
          {turn.kind === 'revise' ? (
            <GitBranch size={16} weight="bold" />
          ) : (
            <Sparkle size={16} weight="fill" />
          )}
        </div>

        {/* Turn Content Container */}
        <div
          className={`min-w-0 flex-1 space-y-3.5 rounded-2xl rounded-tl-sm border p-4 shadow-lg transition-all ${
            isActive
              ? 'border-accent-indigo/40 bg-bg-card shadow-[0_0_20px_rgba(99,102,241,0.08)] ring-1 ring-accent-indigo/20'
              : 'border-line bg-bg-secondary/40'
          }`}
        >
          {/* Header Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">{label}</span>
              {turn.version !== null && (
                <span className="rounded bg-accent-indigo/15 border border-accent-indigo/30 px-1.5 py-0.2 text-[10px] font-mono text-accent-indigo font-medium">
                  v{turn.version}
                </span>
              )}
            </div>

            {turn.done && (
              <span className="text-[11px] text-text-muted font-mono">
                {(turn.done.ms / 1000).toFixed(1)}s elapsed · {turn.done.usage.llmCalls} calls
              </span>
            )}
          </div>

          {/* Phase Progress Pipeline */}
          <PhaseTrail
            phases={turn.phases}
            running={turn.status === 'streaming'}
            startedAt={turn.startedAt}
          />

          {/* Rendered Diagrams Tab Selection */}
          {diagrams.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                Generated Diagram Projections ({diagrams.length}):
              </p>
              <DiagramTabs
                diagrams={diagrams}
                activeType={isActive ? activeType : null}
                onSelect={(type) => onSelectDiagram(turn.id, type)}
                displayName={displayName}
              />
            </div>
          )}

          {/* Integrity & Diagnostics Panel */}
          {turn.done && <IntegrityPanel done={turn.done} displayName={displayName} />}

          {/* Error Banner */}
          {turn.error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-accent-rose/40 bg-accent-rose/10 p-3 text-xs text-accent-rose">
              <WarningCircle size={15} weight="bold" className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Turn execution interrupted</p>
                <p className="mt-0.5 text-[11px] text-accent-rose/90">{turn.error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


