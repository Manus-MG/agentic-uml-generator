import { useState } from 'react';
import {
  Code,
  Cpu,
  Image as ImageIcon,
  Lightning,
  Stack,
} from '@phosphor-icons/react';
import { DiagramView } from './DiagramView';
import { ModelDrawer } from './ModelDrawer';
import type { DiagramPayload, DiagramTypesResponse } from '../types/uml';

type Tab = 'diagram' | 'source' | 'model';

export function DiagramPane({
  sessionId,
  diagram,
  version,
  catalogue,
  displayName,
  onSwitchView,
  switching,
  lastSwitchCost,
}: {
  sessionId: string | null;
  diagram: DiagramPayload | null;
  version: number | null;
  catalogue: DiagramTypesResponse | null;
  displayName: (id: string) => string;
  onSwitchView: (type: string) => void;
  switching: string | null;
  lastSwitchCost: { type: string; llmCalls: number } | null;
}) {
  const [tab, setTab] = useState<Tab>('diagram');

  if (!sessionId || !diagram) {
    return (
      <aside className="hidden w-[42%] min-w-96 shrink-0 flex-col items-center justify-center border-l border-line bg-bg-secondary p-8 text-center xl:flex">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-bg-primary text-accent-orange shadow-sm">
          <Stack size={28} className="text-text-muted" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-text-primary">Studio Canvas Standby</h3>
        <p className="mt-1.5 max-w-xs text-xs text-text-muted leading-relaxed">
          Diagrams synthesized from the canonical model will project here with pan, zoom, syntax verification, and export tools.
        </p>
      </aside>
    );
  }

  const tabs = [
    { id: 'diagram' as Tab, label: 'Rendered Canvas', icon: ImageIcon },
    { id: 'source' as Tab, label: 'PlantUML Source', icon: Code },
    { id: 'model' as Tab, label: 'Canonical Model AST', icon: Cpu },
  ];

  return (
    <aside className="hidden w-[42%] min-w-[420px] shrink-0 flex-col border-l border-line bg-bg-secondary xl:flex">
      {/* Pane Header */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 bg-bg-secondary">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-bold text-text-primary">
              {displayName(diagram.type)}
            </h2>
            {version !== null && (
              <span className="rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.2 text-[10px] font-mono text-orange-400 font-semibold">
                v{version}
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted truncate">
            {diagram.valid === null
              ? 'Syntax verification pending'
              : diagram.valid
                ? 'Syntax verified by PlantUML engine'
                : 'Syntax issues reported'}
            {diagram.repairAttempts > 0 && ` (${diagram.repairAttempts} auto-repaired)`}
            {diagram.carriedForward && ' · cached'}
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-line bg-bg-primary p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                tab === id
                  ? 'bg-orange-500/20 text-orange-400 font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon size={14} weight={tab === id ? 'bold' : 'regular'} />
              <span className="hidden sm:inline">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Pane Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'diagram' && <DiagramView diagram={diagram} />}

        {tab === 'source' && (
          <div className="rounded-xl border border-line bg-bg-primary p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">PlantUML Source Code</span>
              <span className="text-[10px] text-text-muted font-mono">{diagram.source.split('\n').length} lines</span>
            </div>
            <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-accent-emerald selection:bg-orange-500/30">
              {diagram.source}
            </pre>
          </div>
        )}

        {tab === 'model' && <ModelDrawer sessionId={sessionId} version={version} />}
      </div>

      {/* Footer On-Demand View Switcher */}
      <div className="space-y-3 border-t border-line bg-bg-secondary p-4">
        {/* Zero-Cost Model Projection Selector */}
        <div className="rounded-xl border border-line bg-bg-primary p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
              <Lightning size={13} weight="fill" className="text-amber-400" />
              <span>Project Alternate Views</span>
            </p>
            <span className="text-[10px] text-accent-emerald font-medium">0 LLM calls (cached AST)</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(catalogue?.data ?? []).map((model) => {
              const isCurrent = model.id === diagram.type;
              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={switching !== null || isCurrent}
                  onClick={() => onSwitchView(model.id)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                    isCurrent
                      ? 'border-orange-500 bg-orange-500/15 text-orange-400 cursor-default font-semibold'
                      : 'border-line bg-bg-secondary text-text-secondary hover:border-orange-500/30 hover:bg-bg-card-hover hover:text-text-primary disabled:opacity-40'
                  }`}
                >
                  {switching === model.id ? 'synthesizing…' : model.name.replace(/ Diagram$/, '')}
                </button>
              );
            })}
          </div>

          {lastSwitchCost && (
            <p className="mt-2 text-[11px] text-text-muted">
              <span className="font-semibold text-text-secondary">{displayName(lastSwitchCost.type)}</span>:{' '}
              {lastSwitchCost.llmCalls === 0
                ? '⚡ Projected directly from active Canonical System Model (0 LLM calls)'
                : `Synthesized with ${lastSwitchCost.llmCalls} LLM call(s) to populate slice`}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}


