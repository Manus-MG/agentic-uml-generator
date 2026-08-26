import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle,
  CircleNotch,
  Cpu,
  FileCode,
  GitBranch,
  ShieldCheck,
  Sparkle,
  Stack,
  Wrench,
} from '@phosphor-icons/react';
import type { Phase } from '../hooks/useChat';

const PIPELINE_STEPS = [
  { id: 'requirements', label: 'Requirements', icon: Sparkle, desc: 'Parsing architectural requirements' },
  { id: 'csm', label: 'Canonical AST', icon: Cpu, desc: 'Synthesizing canonical system model' },
  { id: 'patch', label: 'Patch Slice', icon: GitBranch, desc: 'Diffing and patching active slices' },
  { id: 'plan', label: 'Slice Planner', icon: Stack, desc: 'Planning projection slices' },
  { id: 'repair-csm', label: 'Model Repair', icon: Wrench, desc: 'Resolving integrity constraints' },
  { id: 'repair-diagram', label: 'Syntax Repair', icon: ShieldCheck, desc: 'Fixing PlantUML syntax' },
  { id: 'render', label: 'Rendering', icon: FileCode, desc: 'Generating vector diagrams' },
];

function getStepMeta(phase: string) {
  return (
    PIPELINE_STEPS.find((s) => s.id === phase) ?? {
      id: phase,
      label: phase,
      icon: Cpu,
      desc: phase,
    }
  );
}

export function PhaseTrail({
  phases,
  running,
  startedAt,
}: {
  phases: Phase[];
  running: boolean;
  startedAt: number;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (phases.length === 0 && !running) return null;

  const elapsed = Math.max(0, Math.round(((running ? now : Date.now()) - startedAt) / 1000));
  const current = phases[phases.length - 1];
  const currentMeta = current ? getStepMeta(current.phase) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg-secondary/60 p-3 shadow-inner">
      {/* Active Phase Header with Live Timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-6 items-center justify-center rounded-md ${
              running
                ? 'bg-accent-indigo/20 text-accent-indigo'
                : 'bg-accent-emerald/20 text-accent-emerald'
            }`}
          >
            {running ? (
              <CircleNotch size={14} className="animate-spin text-accent-indigo" />
            ) : (
              <Check size={14} weight="bold" className="text-accent-emerald" />
            )}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
              <span>{running ? currentMeta?.label ?? 'Processing…' : 'Generation Complete'}</span>
              {current?.detail && (
                <span className="rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-accent-cyan">
                  {current.detail}
                </span>
              )}
            </p>
            <p className="text-[11px] text-text-muted">
              {running ? currentMeta?.desc : 'All slices synthesized & diagrams verified.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {running && (
            <span className="flex items-center gap-1 rounded-md border border-line bg-bg-primary/80 px-2 py-0.5 font-mono text-xs text-text-secondary">
              <span className="size-1.5 animate-ping rounded-full bg-accent-indigo" />
              {elapsed}s
            </span>
          )}
        </div>
      </div>

      {/* Pipeline Sequence Badges */}
      {phases.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-line/60">
          {phases.map((phase, index) => {
            const meta = getStepMeta(phase.phase);
            const isLast = index === phases.length - 1;

            return (
              <div
                key={index}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors ${
                  isLast && running
                    ? 'border border-accent-indigo/40 bg-accent-indigo/15 text-accent-indigo font-medium'
                    : 'border border-line/40 bg-bg-tertiary/40 text-text-muted'
                }`}
              >
                {isLast && running ? (
                  <CircleNotch size={11} className="animate-spin text-accent-indigo" />
                ) : (
                  <CheckCircle size={12} weight="fill" className="text-accent-emerald/80" />
                )}
                <span>{meta.label}</span>
                {phase.detail && (
                  <span className="font-mono text-[9px] text-text-secondary">({phase.detail})</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


