import { useState } from 'react';
import { Cpu, Image as ImageIcon, Code2, Layers, Zap } from 'lucide-react';
import { DiagramView } from './DiagramView';
import { FeedbackBar } from './FeedbackBar';
import { ModelDrawer } from './ModelDrawer';
import type { KnownRating } from '../hooks/useFeedback';
import type { DiagramPayload, DiagramTypesResponse } from '../types/uml';

type Tab = 'diagram' | 'source' | 'model';

/**
 * The large view of whichever diagram is selected in the transcript.
 *
 * The quick-switch row is the canonical model's payoff made visible: asking for
 * a view nobody requested costs zero LLM calls whenever the slice it needs is
 * already populated.
 */
export function DiagramPane({
  sessionId,
  diagram,
  version,
  catalogue,
  displayName,
  onSwitchView,
  switching,
  lastSwitchCost,
  knownRating,
  onRated,
}: {
  sessionId: string | null;
  diagram: DiagramPayload | null;
  version: number | null;
  catalogue: DiagramTypesResponse | null;
  displayName: (id: string) => string;
  onSwitchView: (type: string) => void;
  switching: string | null;
  lastSwitchCost: { type: string; llmCalls: number } | null;
  knownRating?: KnownRating;
  onRated: (diagramId: string, value: KnownRating) => void;
}) {
  const [tab, setTab] = useState<Tab>('diagram');

  if (!sessionId || !diagram) {
    return (
      <aside className="hidden w-[38%] min-w-96 shrink-0 flex-col items-center justify-center border-l border-line bg-bg-secondary/20 p-6 text-center xl:flex">
        <Layers size={24} className="mb-3 text-text-muted" />
        <p className="text-sm text-text-secondary">No diagram selected</p>
        <p className="mt-1 text-xs text-text-muted">
          Diagrams appear here as they are produced. Pick one from a message to enlarge it.
        </p>
      </aside>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof ImageIcon }[] = [
    { id: 'diagram', label: 'Diagram', icon: ImageIcon },
    { id: 'source', label: 'PlantUML', icon: Code2 },
    { id: 'model', label: 'Model', icon: Cpu },
  ];

  return (
    <aside className="hidden w-[38%] min-w-96 shrink-0 flex-col border-l border-line bg-bg-secondary/20 xl:flex">
      <div className="flex items-center justify-between gap-2 border-b border-line p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{displayName(diagram.type)}</p>
          <p className="text-[11px] text-text-muted">
            {version !== null && `v${version} · `}
            {diagram.valid === null
              ? 'not yet checked'
              : diagram.valid
                ? 'syntax verified by PlantUML'
                : 'syntax rejected'}
            {diagram.repairAttempts > 0 && ` · ${diagram.repairAttempts} auto-repair`}
            {diagram.carriedForward && ' · carried forward unchanged'}
          </p>
        </div>

        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => setTab(id)}
              className={`rounded-md border p-1.5 transition ${
                tab === id
                  ? 'border-line-active bg-accent-indigo/15 text-text-primary'
                  : 'border-line text-text-muted hover:bg-bg-card-hover'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'diagram' && <DiagramView diagram={diagram} />}
        {tab === 'source' && (
          <pre className="overflow-x-auto rounded-lg border border-line bg-bg-primary/60 p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
            {diagram.source}
          </pre>
        )}
        {tab === 'model' && <ModelDrawer sessionId={sessionId} version={version} />}
      </div>

      <div className="space-y-2 border-t border-line p-3">
        {/* Keyed by diagram: a rating and its comment belong to one diagram at one
            version, and must not follow the user to the next tab. */}
        {diagram.diagramId && (
          <FeedbackBar
            key={diagram.diagramId}
            sessionId={sessionId}
            diagram={diagram}
            known={knownRating}
            onRated={onRated}
          />
        )}

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-text-muted">
            <Zap size={11} /> Another view from the same model
          </p>
          <div className="flex flex-wrap gap-1">
            {(catalogue?.data ?? []).map((model) => (
              <button
                key={model.id}
                type="button"
                disabled={switching !== null}
                onClick={() => onSwitchView(model.id)}
                className="rounded-md border border-line bg-bg-secondary/40 px-2 py-1 text-[11px] text-text-secondary transition hover:bg-bg-card-hover disabled:opacity-40"
              >
                {switching === model.id ? 'loading…' : model.name.replace(/ Diagram$/, '')}
              </button>
            ))}
          </div>
          {lastSwitchCost && (
            <p className="mt-1.5 text-[11px] text-text-muted">
              {displayName(lastSwitchCost.type)}:{' '}
              {lastSwitchCost.llmCalls === 0
                ? 'served from the stored model — 0 LLM calls'
                : `${lastSwitchCost.llmCalls} LLM call${lastSwitchCost.llmCalls === 1 ? '' : 's'} to fill a missing slice`}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
