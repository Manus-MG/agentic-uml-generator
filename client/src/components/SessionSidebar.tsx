import { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  DownloadSimple,
  HardDrives,
  MagnifyingGlass,
  PlusCircle,
  Stack,
  Trash,
  UserCircle,
  UserSwitch,
  X,
} from '@phosphor-icons/react';
import type { HealthStatus } from '../hooks/useHealth';
import type { BackendHealthResponse, SessionSummary, UserProfile } from '../types/uml';

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const STATUS_STYLE: Record<HealthStatus, { text: string; dot: string; label: string }> = {
  ok: { text: 'text-accent-emerald', dot: 'bg-accent-emerald', label: 'All Systems Operational' },
  degraded: { text: 'text-accent-amber', dot: 'bg-accent-amber', label: 'Degraded' },
  unreachable: { text: 'text-accent-rose', dot: 'bg-accent-rose', label: 'Backend Unreachable' },
  checking: { text: 'text-text-muted', dot: 'bg-text-muted animate-pulse', label: 'Checking Health…' },
};

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  health,
  status,
  exportUrl,
  currentUser,
  onOpenUserModal,
}: {
  sessions: SessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  health: BackendHealthResponse | null;
  status: HealthStatus;
  exportUrl: string;
  currentUser: UserProfile | null;
  onOpenUserModal: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const query = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.sessionId.toLowerCase().includes(query),
    );
  }, [sessions, search]);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-bg-secondary">
      {/* Active User Card & Switch Action */}
      <div className="border-b border-line p-3 bg-bg-primary/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-indigo/20 text-accent-indigo font-bold text-xs border border-accent-indigo/30">
              {currentUser ? currentUser.name.charAt(0).toUpperCase() : <UserCircle size={16} />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-text-primary">
                {currentUser ? currentUser.name : 'Guest / No User'}
              </p>
              <p className="truncate text-[10px] font-mono text-text-muted">
                {currentUser?.userId ?? 'Anonymous'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenUserModal}
            title="Switch or Change User"
            className="flex items-center gap-1 rounded-lg border border-line bg-bg-secondary px-2 py-1 text-[11px] font-medium text-text-secondary transition hover:border-line-hover hover:text-text-primary hover:bg-bg-tertiary"
          >
            <UserSwitch size={13} className="text-accent-indigo" />
            <span>Switch</span>
          </button>
        </div>
      </div>

      {/* Top New Chat Action */}
      <div className="border-b border-line p-3 space-y-2">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-indigo px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-accent-indigo-hover active:translate-y-px shadow-sm"
        >
          <PlusCircle size={16} weight="bold" />
          <span>New Architecture Session</span>
        </button>

        {/* Session Search Input */}
        {sessions.length > 0 && (
          <div className="relative">
            <MagnifyingGlass size={13} className="absolute top-2.5 left-2.5 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions…"
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
        )}
      </div>

      {/* Session List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
          <span>{currentUser ? `${currentUser.name}'s Sessions` : 'Sessions'}</span>
          <span className="font-mono text-[10px]">{filteredSessions.length}</span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line p-4 text-center">
            <Stack size={20} className="mx-auto text-text-muted" />
            <p className="mt-2 text-xs font-medium text-text-secondary">No sessions found</p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {search ? 'Try a different search query' : 'Synthesize your first architecture'}
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredSessions.map((session) => {
              const active = session.sessionId === activeId;
              return (
                <li key={session.sessionId}>
                  <div
                    className={`group flex items-start gap-2 rounded-lg border p-2.5 transition ${
                      active
                        ? 'border-accent-indigo bg-bg-tertiary text-text-primary shadow-sm'
                        : 'border-transparent text-text-secondary hover:border-line hover:bg-bg-card hover:text-text-primary'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(session.sessionId)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-medium">{session.title}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={11} />
                          {relative(session.updatedAt)}
                        </span>
                        <span>•</span>
                        <span className="rounded bg-bg-primary px-1 py-0.2 font-mono text-[10px] text-text-secondary border border-line">
                          v{session.currentVersion}
                        </span>
                        <span>•</span>
                        <span>{session.turnCount} turn{session.turnCount === 1 ? '' : 's'}</span>
                      </div>
                    </button>

                    {confirming === session.sessionId ? (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          title="Confirm delete"
                          onClick={() => {
                            setConfirming(null);
                            onDelete(session.sessionId);
                          }}
                          className="rounded bg-accent-rose/20 p-1 text-accent-rose hover:bg-accent-rose/30"
                        >
                          <Check size={13} weight="bold" />
                        </button>
                        <button
                          type="button"
                          title="Cancel"
                          onClick={() => setConfirming(null)}
                          className="rounded p-1 text-text-muted hover:text-text-primary"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        title="Delete this session"
                        onClick={() => setConfirming(session.sessionId)}
                        className="rounded p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:bg-accent-rose/15 hover:text-accent-rose"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer System HUD & RL Export */}
      <div className="space-y-2.5 border-t border-line bg-bg-primary p-3">
        <a
          href={exportUrl}
          download
          className="flex items-center justify-between rounded-lg border border-line bg-bg-secondary px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-line-hover hover:text-text-primary"
        >
          <div className="flex items-center gap-2">
            <DownloadSimple size={14} className="text-accent-indigo" />
            <span>RLHF Dataset (.jsonl)</span>
          </div>
          <span className="rounded bg-bg-tertiary px-1.5 py-0.2 text-[9px] font-mono text-text-muted">
            ART Trajectory
          </span>
        </a>

        {/* Service Health Badges */}
        <div className="rounded-lg border border-line bg-bg-secondary p-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
              <span className={`size-2 rounded-full ${STATUS_STYLE[status].dot}`} />
              {STATUS_STYLE[status].label}
            </span>
            <HardDrives size={13} className="text-text-muted" />
          </div>

          {(status === 'ok' || status === 'degraded') && health?.checks && (
            <div className="mt-1.5 grid grid-cols-3 gap-1 pt-1.5 border-t border-line/60 text-[10px] font-mono text-text-muted">
              <div>
                <span className="block text-text-muted/70">Mongo</span>
                <span className="text-accent-emerald">{health.checks.mongo}</span>
              </div>
              <div>
                <span className="block text-text-muted/70">PlantUML</span>
                <span className="text-accent-emerald">{health.checks.plantuml}</span>
              </div>
              <div>
                <span className="block text-text-muted/70">Groq</span>
                <span className="text-accent-emerald">{health.checks.groq}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}


