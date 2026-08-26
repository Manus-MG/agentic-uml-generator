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
      ? 'Synthesizing…'
      : turn.kind === 'revise'
        ? `Revision patch → v${turn.version}`
        : turn.version !== null
          ? `Specification synthesized · v${turn.version}`
          : 'Stopped';

  return (
    <div className="flex flex-col gap-3.5">
      {/* User Prompt Message */}
      <div className="group flex justify-end">
        <div className="relative flex max-w-3xl flex-col gap-1.5 rounded-sm border border-line bg-bg-card p-3.5">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-text-muted">
              <div className="flex size-4 items-center justify-center rounded-[2px] bg-bg-tertiary text-text-muted">
                <User size={10} weight="bold" />
              </div>
              <span>Prompt</span>
            </div>

            <button
              type="button"
              onClick={copyPromptText}
              title="Copy prompt text"
              className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary"
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

      {/* Assistant Response */}
      <div className="flex items-start gap-3">
        {/* Agent marker */}
        <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-sm border border-line-active/40 bg-accent-orange text-bg-primary">
          {turn.kind === 'revise' ? (
            <GitBranch size={15} weight="bold" />
          ) : (
            <Sparkle size={15} weight="fill" />
          )}
        </div>

        {/* Turn Content */}
        <div
          className={`min-w-0 flex-1 space-y-3.5 rounded-sm border p-4 transition-colors ${
            isActive
              ? 'border-l-2 border-l-accent-orange border-y-line border-r-line bg-bg-card'
              : 'border-line bg-bg-secondary/50'
          }`}
        >
          {/* Header Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">{label}</span>
              {turn.version !== null && (
                <span className="rounded-sm border border-line-active/40 bg-accent-orange/10 px-1.5 py-0.5 text-[10px] font-mono text-accent-orange">
                  v{turn.version}
                </span>
              )}
            </div>

            {turn.done && (
              <span className="text-[11px] text-text-muted font-mono">
                {(turn.done.ms / 1000).toFixed(1)}s · {turn.done.usage.llmCalls} calls
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
              <p className="text-[11px] font-mono font-semibold tracking-wider text-text-muted uppercase">
                Diagrams ({diagrams.length})
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
            <div className="flex items-start gap-2.5 rounded-sm border border-accent-rose/40 border-l-2 border-l-accent-rose bg-accent-rose/[0.06] p-3 text-xs text-accent-rose">
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
