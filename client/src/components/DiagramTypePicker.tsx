import { useMemo, useState } from 'react';
import {
  Check,
  Cpu,
  MagnifyingGlass,
  Pulse,
  Sparkle,
  SquaresFour,
  TreeStructure,
  X,
} from '@phosphor-icons/react';
import type { DiagramTypesResponse } from '../types/uml';

interface DiagramTypePickerProps {
  catalogue: DiagramTypesResponse | null;
  selected: string[];
  onChange: (next: string[]) => void;
}

export function DiagramTypePicker({ catalogue, selected, onChange }: DiagramTypePickerProps) {
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    if (!catalogue) return [];
    return [
      {
        title: 'Structure Diagrams',
        icon: SquaresFour,
        badge: 'What the system is',
        items: catalogue.categories.structure.items,
      },
      {
        title: 'Behavior Diagrams',
        icon: Pulse,
        badge: 'What the system does',
        items: catalogue.categories.behavior.items,
      },
      {
        title: 'Interaction Diagrams',
        icon: TreeStructure,
        badge: 'Message flows & timing',
        items: catalogue.categories.interaction.items,
      },
    ];
  }, [catalogue]);

  const allIds = useMemo(() => catalogue?.data.map((m) => m.id) ?? [], [catalogue]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const query = search.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.summary.toLowerCase().includes(query) ||
            item.id.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, search]);

  if (!catalogue) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-text-muted">
        <Cpu size={14} className="animate-spin text-accent-indigo" /> Loading UML 2.x catalogue…
      </div>
    );
  }

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const applyPreset = (types: string[]) => {
    onChange(types);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Top Presets and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-text-primary">
            {selected.length}
            <span className="font-normal text-text-muted">/{catalogue.total} selected</span>
          </span>

          <span className="text-line">|</span>

          <button
            type="button"
            onClick={() => applyPreset(['sequence', 'component', 'class'])}
            className="flex items-center gap-1 rounded-md border border-line bg-bg-card px-2 py-1 text-[11px] text-accent-indigo hover:border-accent-indigo/40 hover:bg-accent-indigo/10"
          >
            <Sparkle size={12} weight="fill" /> Recommended (3)
          </button>

          <button
            type="button"
            onClick={() => applyPreset(catalogue.categories.structure.items.map((m) => m.id))}
            className="rounded-md border border-line bg-bg-card px-2 py-1 text-[11px] text-text-secondary hover:border-accent-indigo/40 hover:text-text-primary"
          >
            Structure (7)
          </button>

          <button
            type="button"
            onClick={() =>
              applyPreset([
                ...catalogue.categories.behavior.items.map((m) => m.id),
                ...catalogue.categories.interaction.items.map((m) => m.id),
              ])
            }
            className="rounded-md border border-line bg-bg-card px-2 py-1 text-[11px] text-text-secondary hover:border-accent-indigo/40 hover:text-text-primary"
          >
            Behavior (7)
          </button>

          <button
            type="button"
            onClick={() => applyPreset(allIds)}
            className="rounded-md border border-line bg-bg-card px-2 py-1 text-[11px] text-text-secondary hover:border-accent-indigo/40 hover:text-text-primary"
          >
            All 14
          </button>

          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-md px-1.5 py-1 text-[11px] text-text-muted hover:text-accent-rose"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative min-w-36 flex-1 sm:max-w-48">
          <MagnifyingGlass size={13} className="absolute top-2.5 left-2.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter diagrams…"
            className="w-full rounded-md border border-line bg-bg-primary py-1.5 pr-6 pl-7 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-indigo focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute top-2 right-2 text-text-muted hover:text-text-primary"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Categorized Diagram Type Cards */}
      <div className="space-y-3">
        {filteredGroups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                <Icon size={13} weight="bold" className="text-accent-indigo" />
                <span>{group.title}</span>
                <span className="font-normal text-text-muted/70">({group.badge})</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                {group.items.map((item) => {
                  const isSelected = selected.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.summary}
                      onClick={() => toggle(item.id)}
                      className={`group relative flex flex-col items-start rounded-lg border p-2 text-left transition-all ${
                        isSelected
                          ? 'border-accent-indigo bg-accent-indigo/15 text-text-primary ring-1 ring-accent-indigo/30'
                          : 'border-line bg-bg-secondary text-text-secondary hover:border-line-hover hover:bg-bg-card-hover hover:text-text-primary'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <span className="truncate text-xs font-medium">
                          {item.name.replace(/ Diagram$/, '')}
                        </span>
                        <span
                          className={`flex size-3.5 shrink-0 items-center justify-center rounded transition-colors ${
                            isSelected
                              ? 'bg-accent-indigo text-white'
                              : 'border border-line group-hover:border-text-muted'
                          }`}
                        >
                          {isSelected && <Check size={10} weight="bold" />}
                        </span>
                      </div>
                      <span className="mt-0.5 line-clamp-1 text-[10px] text-text-muted group-hover:text-text-secondary">
                        {item.summary}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


