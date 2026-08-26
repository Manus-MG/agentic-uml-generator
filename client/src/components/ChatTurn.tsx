import { AlertCircle, GitBranch, Sparkles, User } from 'lucide-react';
import { DiagramTabs } from './DiagramTabs';
import { IntegrityPanel } from './IntegrityPanel';
import { PhaseTrail } from './PhaseTrail';
import type { Turn } from '../hooks/useChat';

/**
 * One exchange in the transcript.
 *
 * The label is what makes the brief's case 1 and case 2 distinguishable: the
 * same request produced a fresh model or patched an existing one, and only the
 * backend knows which.
 */
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
  const diagrams = [...turn.diagrams.values()];

  const label =
    turn.status === 'streaming'
      ? 'Working…'
      : turn.kind === 'revise'
        ? `Revised → v${turn.version}`
        : turn.version !== null
          ? `Generated v${turn.version}`
          // No version means the run never reached `done` — it was stopped.
          : 'Stopped';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="flex max-w-2xl gap-2.5 rounded-2xl rounded-br-sm border border-line bg-bg-card px-4 py-3">
          <p className="text-sm whitespace-pre-wrap text-text-primary">{turn.prompt}</p>
          <User size={14} className="mt-0.5 shrink-0 text-text-muted" />
        </div>
      </div>

      <div className="flex gap-2.5">
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-accent-indigo to-accent-violet">
          {turn.kind === 'revise' ? (
            <GitBranch size={14} className="text-white" />
          ) : (
            <Sparkles size={14} className="text-white" />
          )}
        </div>

        <div
          className={`min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-sm border p-3 transition ${
            isActive ? 'border-line-active bg-bg-card' : 'border-line bg-bg-secondary/30'
          }`}
        >
          <p className="text-xs font-medium text-text-secondary">{label}</p>

          <PhaseTrail
            phases={turn.phases}
            running={turn.status === 'streaming'}
            startedAt={turn.startedAt}
          />

          {diagrams.length > 0 && (
            <DiagramTabs
              diagrams={diagrams}
              activeType={isActive ? activeType : null}
              onSelect={(type) => onSelectDiagram(turn.id, type)}
              displayName={displayName}
            />
          )}

          {turn.done && <IntegrityPanel done={turn.done} displayName={displayName} />}

          {turn.error && (
            <p className="flex items-start gap-2 rounded-lg border border-accent-rose/40 bg-accent-rose/10 p-2.5 text-xs text-accent-rose">
              <AlertCircle size={14} className="mt-px shrink-0" />
              {turn.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
