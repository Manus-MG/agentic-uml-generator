import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { Phase } from '../hooks/useChat';

const LABELS: Record<string, string> = {
  requirements: 'Reading the brief into a requirement model',
  plan: 'Planning which parts of the model to change',
  csm: 'Building the canonical model',
  patch: 'Patching the canonical model',
  'repair-csm': 'Repairing model integrity',
  'repair-diagram': 'Repairing diagram syntax',
  render: 'Rendering diagrams',
};

function label(phase: string): string {
  return LABELS[phase] ?? phase;
}

/**
 * Live progress.
 *
 * The stream carries no heartbeat, so a single slice call can leave it silent
 * for tens of seconds. The elapsed timer is what tells a waiting user that
 * silence is work rather than a hang.
 */
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

  return (
    <div className="rounded-lg border border-line bg-bg-secondary/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-medium text-text-secondary">
          {running ? (
            <Loader2 size={13} className="animate-spin text-accent-indigo" />
          ) : (
            <Check size={13} className="text-accent-emerald" />
          )}
          {current ? label(current.phase) : 'Starting…'}
          {current?.detail && <span className="font-mono text-text-muted">{current.detail}</span>}
        </p>
        {running && <span className="font-mono text-xs text-text-muted">{elapsed}s</span>}
      </div>

      {phases.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {phases.slice(0, -1).map((phase, index) => (
            <span
              key={index}
              className="rounded bg-bg-tertiary/60 px-1.5 py-px font-mono text-[10px] text-text-muted"
            >
              {phase.phase}
              {phase.detail ? `:${phase.detail}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
