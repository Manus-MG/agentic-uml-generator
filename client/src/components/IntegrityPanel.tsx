import {
  Clock,
  Coins,
  Cpu,
  Quotes,
  ShieldCheck,
  ShieldWarning,
  Stack,
  Warning,
} from '@phosphor-icons/react';
import type { DoneEvent } from '../types/uml';

export function IntegrityPanel({
  done,
  displayName,
}: {
  done: DoneEvent;
  displayName: (id: string) => string;
}) {
  const issues = [...done.integrity.errors, ...done.integrity.warnings];

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-bg-primary/50 p-3 text-xs">
      {/* Top Status & Telemetry Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium ${
              done.integrity.ok
                ? 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald'
                : 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber'
            }`}
          >
            {done.integrity.ok ? (
              <ShieldCheck size={14} weight="bold" />
            ) : (
              <ShieldWarning size={14} weight="bold" />
            )}
            {done.integrity.ok ? 'AST Consistent' : 'Integrity Warnings Detected'}
          </span>

          {done.mode === 'revise' && (
            <span className="rounded-md border border-accent-indigo/30 bg-accent-indigo/10 px-2 py-1 text-[11px] font-medium text-accent-indigo">
              Patch Applied
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <Cpu size={12} /> {done.usage.llmCalls} call{done.usage.llmCalls === 1 ? '' : 's'}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Coins size={12} /> {done.usage.totalTokens.toLocaleString()} tokens
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock size={12} /> {(done.ms / 1000).toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Changed Slices in Revision */}
      {done.mode === 'revise' && done.changedSlices.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-bg-secondary/60 px-2.5 py-1.5 text-[11px]">
          <Stack size={13} className="text-accent-indigo" />
          <span className="text-text-muted">Modified AST Slices:</span>
          <div className="flex flex-wrap gap-1">
            {done.changedSlices.map((slice) => (
              <span
                key={slice}
                className="rounded bg-accent-indigo/15 px-1.5 py-0.5 font-mono text-[10px] text-accent-indigo border border-accent-indigo/30"
              >
                {slice}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Rationale Quote */}
      {done.rationale && (
        <div className="flex gap-2 rounded-lg border border-line/60 bg-bg-secondary/40 p-2.5 text-text-secondary">
          <Quotes size={14} weight="fill" className="mt-0.5 shrink-0 text-accent-indigo/70" />
          <p className="text-[11px] leading-relaxed italic">{done.rationale}</p>
        </div>
      )}

      {/* Unknown Types Warning */}
      {done.unknownTypes.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-2 text-accent-amber">
          <Warning size={14} weight="bold" className="shrink-0" />
          <p className="text-[11px]">
            Unrecognized diagram types skipped: <span className="font-mono">{done.unknownTypes.join(', ')}</span>
          </p>
        </div>
      )}

      {/* Integrity Diagnostic Log */}
      {issues.length > 0 && (
        <div className="space-y-1 rounded-lg border border-line/60 bg-bg-secondary/30 p-2">
          <p className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
            Consistency Log ({issues.length})
          </p>
          <ul className="space-y-1">
            {issues.slice(0, 5).map((issue, index) => (
              <li key={index} className="flex items-start gap-1.5 font-mono text-[11px]">
                <span
                  className={`shrink-0 rounded px-1 text-[9px] uppercase font-bold ${
                    issue.severity === 'error'
                      ? 'bg-accent-rose/20 text-accent-rose'
                      : 'bg-accent-amber/20 text-accent-amber'
                  }`}
                >
                  {issue.severity}
                </span>
                <span className="text-text-muted">{issue.path}:</span>
                <span className="text-text-secondary">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rendered Views List */}
      {done.diagramTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-text-muted">
          <span>Rendered projections:</span>
          {done.diagramTypes.map((type, idx) => (
            <span key={type} className="font-medium text-text-secondary">
              {displayName(type)}
              {idx < done.diagramTypes.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


