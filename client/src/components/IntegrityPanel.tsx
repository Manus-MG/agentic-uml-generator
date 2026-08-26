import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { DoneEvent } from '../types/uml';

/**
 * What the turn actually did to the model.
 *
 * `changedSlices` is the visible half of the revision story: it explains why
 * some diagrams were re-rendered and others were carried forward untouched.
 */
export function IntegrityPanel({ done, displayName }: { done: DoneEvent; displayName: (id: string) => string }) {
  const issues = [...done.integrity.errors, ...done.integrity.warnings];

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${
            done.integrity.ok
              ? 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald'
              : 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber'
          }`}
        >
          {done.integrity.ok ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
          {done.integrity.ok ? 'Model is internally consistent' : 'Model has integrity issues'}
        </span>

        <span className="rounded-md border border-line bg-bg-secondary/40 px-2 py-1 text-text-muted">
          {done.usage.llmCalls} LLM call{done.usage.llmCalls === 1 ? '' : 's'} ·{' '}
          {done.usage.totalTokens.toLocaleString()} tokens · {(done.ms / 1000).toFixed(1)}s
        </span>
      </div>

      {done.mode === 'revise' && done.changedSlices.length > 0 && (
        <p className="text-text-muted">
          Changed:{' '}
          {done.changedSlices.map((slice) => (
            <span key={slice} className="mr-1 rounded bg-bg-tertiary/60 px-1.5 py-px font-mono text-[10px]">
              {slice}
            </span>
          ))}
        </p>
      )}

      {done.unknownTypes.length > 0 && (
        <p className="text-accent-amber">
          Not recognised, and skipped: {done.unknownTypes.join(', ')}
        </p>
      )}

      {done.rationale && <p className="text-text-secondary">{done.rationale}</p>}

      {issues.length > 0 && (
        <ul className="space-y-1">
          {issues.slice(0, 6).map((issue, index) => (
            <li key={index} className="font-mono text-[11px] text-text-muted">
              <span className={issue.severity === 'error' ? 'text-accent-rose' : 'text-accent-amber'}>
                {issue.severity}
              </span>{' '}
              {issue.path} — {issue.message}
            </li>
          ))}
        </ul>
      )}

      {done.diagramTypes.length > 0 && (
        <p className="text-text-muted">
          Views: {done.diagramTypes.map(displayName).join(' · ')}
        </p>
      )}
    </div>
  );
}
