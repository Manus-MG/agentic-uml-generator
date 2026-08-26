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
  { id: 'csm', label: 'Canonical model', icon: Cpu, desc: 'Synthesizing canonical system model' },
  { id: 'patch', label: 'Patch slice', icon: GitBranch, desc: 'Diffing and patching active slices' },
  { id: 'plan', label: 'Slice planner', icon: Stack, desc: 'Planning projection slices' },
  { id: 'repair-csm', label: 'Model repair', icon: Wrench, desc: 'Resolving integrity constraints' },
  { id: 'repair-diagram', label: 'Syntax repair', icon: ShieldCheck, desc: 'Fixing PlantUML syntax' },
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
    <div className="overflow-hidden rounded-sm border border-line bg-bg-secondary/60 p-3">
      {/* Active Phase Header with Live Timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-6 items-center justify-center rounded-sm ${
              running
                ? 'bg-accent-orange/10 text-accent-orange'
                : 'bg-accent-emerald/10 text-accent-emerald'
            }`}
          >
            {running ? (
              <CircleNotch size={14} className="animate-spin" />
            ) : (
              <Check size={14} weight="bold" />
            )}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
              <span>{running ? currentMeta?.label ?? 'Processing…' : 'Generation complete'}</span>
              {current?.detail && (
                <span className="rounded-sm bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-accent-orange">
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
            <span className="flex items-center gap-1.5 rounded-sm border border-line bg-bg-primary/80 px-2 py-0.5 font-mono text-xs text-text-secondary">
              <span className="size-1.5 rounded-full bg-accent-orange animate-blink" />
              {elapsed}s
            </span>
          )}
        </div>
      </div>

      {/* Pipeline Sequence Badges */}
      {phases.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-line">
          {phases.map((phase, index) => {
            const meta = getStepMeta(phase.phase);
            const isLast = index === phases.length - 1;

            return (
              <div
                key={index}
                className={`flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] transition-colors ${
                  isLast && running
                    ? 'border border-line-active/40 bg-accent-orange/10 text-accent-orange font-medium'
                    : 'border border-line bg-bg-tertiary/40 text-text-muted'
                }`}
              >
                {isLast && running ? (
                  <CircleNotch size={11} className="animate-spin" />
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
