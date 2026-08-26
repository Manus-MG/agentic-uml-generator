import {
  FileCode,
  Pulse,
  ShareNetwork,
  SquaresFour,
  Stack,
  TreeStructure,
  Users,
} from '@phosphor-icons/react';
import type { DiagramPayload } from '../types/uml';

function getDiagramIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'sequence':
    case 'communication':
    case 'timing':
    case 'interaction_overview':
      return TreeStructure;
    case 'component':
    case 'composite_structure':
      return SquaresFour;
    case 'class':
    case 'object':
    case 'package':
      return Stack;
    case 'use_case':
      return Users;
    case 'activity':
    case 'state_machine':
      return Pulse;
    case 'deployment':
      return ShareNetwork;
    default:
      return FileCode;
  }
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
        const Icon = getDiagramIcon(diagram.type);

        return (
          <button
            key={diagram.type}
            type="button"
            onClick={() => onSelect(diagram.type)}
            className={`group flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'border-line-active bg-accent-orange/10 text-text-primary'
                : 'border-line bg-bg-secondary text-text-secondary hover:border-line-hover hover:bg-bg-card-hover hover:text-text-primary'
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                diagram.valid === null
                  ? 'bg-text-muted animate-pulse'
                  : diagram.valid
                    ? 'bg-accent-emerald'
                    : 'bg-accent-rose'
              }`}
            />
            <Icon size={14} weight={active ? 'bold' : 'regular'} className={active ? 'text-accent-orange' : 'text-text-muted group-hover:text-text-secondary'} />
            <span>{displayName(diagram.type)}</span>
            {diagram.carriedForward && (
              <span className="rounded-sm bg-bg-tertiary px-1 py-0.5 text-[9px] text-text-muted uppercase font-mono">
                cached
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
