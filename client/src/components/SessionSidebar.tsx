import { useState } from 'react';
import { Check, Clock, MessageSquarePlus, Server, Trash2, X } from 'lucide-react';
import type { HealthStatus } from '../hooks/useHealth';
import type { BackendHealthResponse, SessionSummary } from '../types/uml';

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const STATUS_STYLE: Record<HealthStatus, string> = {
  ok: 'text-accent-emerald',
  degraded: 'text-accent-amber',
  unreachable: 'text-accent-rose',
  checking: 'text-text-muted',
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
}: {
  sessions: SessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  health: BackendHealthResponse | null;
  status: HealthStatus;
  exportUrl: string;
}) {
  // An inline confirm rather than window.confirm: a modal dialog blocks the
  // whole page, and deleting a chat does not warrant that.
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-bg-secondary/40">
      <div className="border-b border-line p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-br from-accent-indigo to-accent-violet px-3 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <MessageSquarePlus size={16} /> New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-1 pb-2 text-[11px] font-medium tracking-wide text-text-muted uppercase">
          Sessions
        </p>

        {sessions.length === 0 ? (
          <p className="px-1 text-xs text-text-muted">
            No sessions yet. Start a chat and describe a system.
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => {
              const active = session.sessionId === activeId;
              return (
                <li key={session.sessionId}>
                  <div
                    className={`group flex items-start gap-2 rounded-lg border px-2.5 py-2 transition ${
                      active
                        ? 'border-line-active bg-accent-indigo/10'
                        : 'border-transparent hover:bg-bg-card-hover'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(session.sessionId)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs text-text-primary">{session.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                        <Clock size={10} />
                        {relative(session.updatedAt)} · v{session.currentVersion} · {session.turnCount} turn
                        {session.turnCount === 1 ? '' : 's'}
                      </p>
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
                          className="rounded p-1 text-accent-rose hover:bg-accent-rose/15"
                        >
                          <Check size={13} />
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
                        title="Delete this session (ratings are kept)"
                        onClick={() => setConfirming(session.sessionId)}
                        className="rounded p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:text-accent-rose"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-line p-3">
        <a
          href={exportUrl}
          download
          className="block rounded-lg border border-line px-2.5 py-2 text-xs text-text-secondary transition hover:bg-bg-card-hover"
        >
          Download RL training data (.jsonl)
          <span className="mt-0.5 block text-[11px] text-text-muted">
            Ratings joined to LLM trajectories, for the ART trainer.
          </span>
        </a>

        <p className={`flex items-center gap-1.5 text-[11px] ${STATUS_STYLE[status]}`}>
          <Server size={11} />
          {status === 'checking' && 'Checking backend…'}
          {status === 'unreachable' && 'Backend unreachable'}
          {(status === 'ok' || status === 'degraded') &&
            `${health?.checks?.mongo ?? '?'} · ${health?.checks?.plantuml ?? '?'} · groq ${
              health?.checks?.groq ?? '?'
            }`}
        </p>
      </div>
    </aside>
  );
}
