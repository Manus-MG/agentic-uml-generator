import type { DiagramTypesResponse } from '../types/uml';

/**
 * The 14 UML types, grouped the way the catalogue groups them.
 *
 * Interaction diagrams are a subset of Behavior, so `behavior.items` already
 * excludes them — rendering all three groups shows each type exactly once.
 */
export function DiagramTypePicker({
  catalogue,
  selected,
  onChange,
}: {
  catalogue: DiagramTypesResponse | null;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (!catalogue) {
    return <p className="text-xs text-text-muted">Loading diagram types…</p>;
  }

  const groups = [catalogue.categories.structure, catalogue.categories.behavior, catalogue.categories.interaction];
  const allIds = catalogue.data.map((model) => model.id);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-text-muted">
          {selected.length}/{catalogue.total} selected
        </span>
        <button type="button" onClick={() => onChange(allIds)} className="text-accent-indigo hover:underline">
          all
        </button>
        <button
          type="button"
          onClick={() => onChange(catalogue.categories.structure.items.map((m) => m.id))}
          className="text-accent-indigo hover:underline"
        >
          structure
        </button>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...catalogue.categories.behavior.items.map((m) => m.id),
              ...catalogue.categories.interaction.items.map((m) => m.id),
            ])
          }
          className="text-accent-indigo hover:underline"
        >
          behavior
        </button>
        <button type="button" onClick={() => onChange([])} className="text-text-muted hover:underline">
          clear
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 text-[11px] font-medium tracking-wide text-text-muted uppercase">
            {group.title}
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {group.items.map((model) => {
              const on = selected.includes(model.id);
              return (
                <button
                  key={model.id}
                  type="button"
                  title={model.summary}
                  onClick={() => toggle(model.id)}
                  className={`rounded-md border px-2 py-1.5 text-left text-xs transition ${
                    on
                      ? 'border-line-active bg-accent-indigo/15 text-text-primary'
                      : 'border-line bg-bg-secondary/40 text-text-secondary hover:bg-bg-card-hover'
                  }`}
                >
                  {model.name.replace(/ Diagram$/, '')}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
