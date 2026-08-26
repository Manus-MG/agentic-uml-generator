import type { DiagramPayload } from '../types/uml';

/** The dot encodes three states, not two: null is "not checked yet". */
function statusDot(valid: boolean | null): string {
  if (valid === null) return 'bg-text-muted animate-pulse';
  return valid ? 'bg-accent-emerald' : 'bg-accent-rose';
}

export function DiagramTabs({
  diagrams,
  activeType,
  onSelect,
  displayName,
}: {
  diagrams: DiagramPayload[];
  activeType: string | null;
  onSelect: (type: string) => void;
  displayName: (id: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {diagrams.map((diagram) => {
        const active = diagram.type === activeType;
        return (
          <button
            key={diagram.type}
            type="button"
            onClick={() => onSelect(diagram.type)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'border-line-active bg-accent-indigo/15 text-text-primary'
                : 'border-line bg-bg-secondary/40 text-text-secondary hover:bg-bg-card-hover'
            }`}
          >
            <span className={`size-1.5 rounded-full ${statusDot(diagram.valid)}`} />
            {displayName(diagram.type)}
            {diagram.carriedForward && (
              <span className="rounded bg-bg-tertiary px-1 py-px text-[10px] text-text-muted">
                unchanged
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
