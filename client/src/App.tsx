import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SidebarSimple,
  SquaresFour,
  UserSwitch,
  WarningCircle,
} from '@phosphor-icons/react';
import { ChatPanel } from './components/ChatPanel';
import { Composer } from './components/Composer';
import { DiagramPane } from './components/DiagramPane';
import { SessionSidebar } from './components/SessionSidebar';
import { UserModal } from './components/UserModal';
import { useChat } from './hooks/useChat';
import { useDiagramTypes } from './hooks/useDiagramTypes';
import { useHealth } from './hooks/useHealth';
import { useSessions } from './hooks/useSessions';
import { useUser } from './hooks/useUser';
import { api } from './services/api';
import type { UserProfile } from './types/uml';

export function App() {
  const { user, knownUsers, identify, selectUser } = useUser();
  const { sessions, activeId, setActiveId, startNew, remove, refresh } = useSessions(user?.userId);
  const { catalogue, displayName } = useDiagramTypes();
  const { health, status } = useHealth();
  const { turns, busy, send, stop, addView } = useChat(activeId, user?.userId);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['sequence', 'component', 'class']);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [lastSwitchCost, setLastSwitchCost] = useState<{ type: string; llmCalls: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [diagramPaneOpen, setDiagramPaneOpen] = useState(true);

  // If no user is identified yet, show identification modal immediately
  const isModalVisible = userModalOpen || !user;

  const activeTurn = useMemo(
    () => turns.find((turn) => turn.id === activeTurnId) ?? turns[turns.length - 1] ?? null,
    [turns, activeTurnId],
  );

  const displayTurn = useMemo(() => {
    if (activeTurn && activeTurn.diagrams.size > 0) return activeTurn;
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      if (turns[i].diagrams.size > 0) return turns[i];
    }
    return activeTurn;
  }, [activeTurn, turns]);

  const activeDiagram = useMemo(() => {
    if (!displayTurn) return null;
    if (activeType && displayTurn.diagrams.has(activeType)) return displayTurn.diagrams.get(activeType)!;
    return [...displayTurn.diagrams.values()][0] ?? null;
  }, [displayTurn, activeType]);

  const activeSessionTitle = useMemo(() => {
    return sessions.find((s) => s.sessionId === activeId)?.title ?? 'New Session';
  }, [sessions, activeId]);

  useEffect(() => {
    const latest = turns[turns.length - 1];
    if (!latest) {
      setActiveTurnId(null);
      setActiveType(null);
      return;
    }
    if (latest.status === 'streaming') {
      setActiveTurnId(latest.id);
      if (!activeType || !latest.diagrams.has(activeType)) {
        setActiveType([...latest.diagrams.keys()][0] ?? null);
      }
    } else if (activeTurnId === null) {
      setActiveTurnId(latest.id);
      setActiveType([...latest.diagrams.keys()][0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, activeTurnId]);

  useEffect(() => {
    if (!activeId) startNew();
  }, [activeId, startNew]);

  const isRevision = turns.length > 0;

  const handleSend = useCallback(
    async (prompt: string, overrideTypes?: string[]) => {
      setError(null);
      await send(prompt, overrideTypes ?? selectedTypes);
      await refresh();
    },
    [send, selectedTypes, refresh],
  );

  const handleSelectTemplate = useCallback(
    (templatePrompt: string, templateTypes: string[]) => {
      setSelectedTypes(templateTypes);
      void handleSend(templatePrompt, templateTypes);
    },
    [handleSend],
  );

  const handleSwitchView = useCallback(
    async (type: string) => {
      if (!activeId) return;
      setSwitching(type);
      setError(null);
      try {
        const result = await addView(type);
        if (result) {
          setLastSwitchCost({ type, llmCalls: result.llmCalls });
          setActiveType(type);
          setActiveTurnId(turns[turns.length - 1]?.id ?? null);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSwitching(null);
      }
    },
    [activeId, addView, turns],
  );

  const handleDelete = useCallback(
    async (sessionId: string) => {
      try {
        await remove(sessionId);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [remove],
  );

  const handleIdentify = useCallback(
    async (name: string) => {
      const res = await identify(name);
      setUserModalOpen(false);
      const userSessions = await refresh();
      if (!res.isNewUser && userSessions && userSessions.length > 0) {
        setActiveId(userSessions[0].sessionId);
      } else {
        startNew();
      }
      setActiveTurnId(null);
      setActiveType(null);
      setLastSwitchCost(null);
    },
    [identify, refresh, setActiveId, startNew],
  );

  const handleSelectUser = useCallback(
    async (selected: UserProfile) => {
      selectUser(selected);
      setUserModalOpen(false);
      try {
        const userSessions = await api.listSessions(selected.userId);
        if (userSessions.sessions.length > 0) {
          setActiveId(userSessions.sessions[0].sessionId);
        } else {
          startNew();
        }
      } catch {
        startNew();
      }
      setActiveTurnId(null);
      setActiveType(null);
      setLastSwitchCost(null);
    },
    [selectUser, setActiveId, startNew],
  );

  return (
    <div className="flex h-full bg-bg-primary text-text-primary">
      {/* User Identification / Switch Modal */}
      <UserModal
        isOpen={isModalVisible}
        currentUser={user}
        knownUsers={knownUsers}
        onIdentify={handleIdentify}
        onSelectUser={handleSelectUser}
        onClose={() => setUserModalOpen(false)}
        canDismiss={!!user}
      />

      {/* Collapsible Left Sidebar */}
      {sidebarOpen && (
        <SessionSidebar
          sessions={sessions}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={() => {
            startNew();
            setActiveTurnId(null);
            setActiveType(null);
            setLastSwitchCost(null);
          }}
          onDelete={handleDelete}
          health={health}
          status={status}
          exportUrl={api.getFeedbackExportUrl(activeId ?? undefined)}
          currentUser={user}
          onOpenUserModal={() => setUserModalOpen(true)}
        />
      )}

      {/* Center Main Workstation */}
      <main className="flex min-w-0 flex-1 flex-col bg-bg-primary">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-line px-4 py-2.5 bg-bg-secondary">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((s) => !s)}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              className="rounded-sm p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
            >
              <SidebarSimple size={16} weight={sidebarOpen ? 'fill' : 'regular'} />
            </button>

            <div className="flex size-7 items-center justify-center rounded-sm border border-line-active bg-accent-orange text-bg-primary">
              <SquaresFour size={15} weight="bold" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xs font-semibold text-text-primary">
                  {activeSessionTitle}
                </h1>
                {displayTurn?.version !== null && displayTurn?.version !== undefined && (
                  <span className="rounded-sm border border-line-active/40 bg-accent-orange/10 px-1.5 py-0.5 text-[10px] font-mono text-accent-orange">
                    v{displayTurn.version}
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] text-text-muted font-mono">
                {activeId ? `session · ${activeId}` : 'no session'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* User Profile in Header */}
            {user && (
              <button
                type="button"
                onClick={() => setUserModalOpen(true)}
                title="Switch user"
                className="flex items-center gap-1.5 rounded-sm border border-line bg-bg-primary px-2.5 py-1 text-[11px] text-text-secondary hover:border-line-hover hover:text-text-primary transition"
              >
                <div className="flex size-4 items-center justify-center rounded-[2px] bg-accent-orange text-[9px] font-bold text-bg-primary">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium text-text-primary">{user.name}</span>
                <span className="text-[10px] font-mono text-text-muted">({user.userId})</span>
                <UserSwitch size={12} className="text-text-muted ml-0.5" />
              </button>
            )}

            <div className="hidden items-center gap-1.5 rounded-sm border border-line bg-bg-primary px-2.5 py-1 text-[11px] font-mono text-text-muted sm:flex">
              <span className="size-1.5 rounded-full bg-accent-emerald" />
              <span className="uppercase tracking-wide">Groq · PlantUML</span>
            </div>

            <button
              type="button"
              onClick={() => setDiagramPaneOpen((d) => !d)}
              title={diagramPaneOpen ? 'Hide diagram canvas' : 'Show diagram canvas'}
              className="rounded-sm p-1 text-text-muted hover:bg-bg-tertiary hover:text-text-primary xl:flex hidden"
            >
              <SidebarSimple size={16} weight={diagramPaneOpen ? 'fill' : 'regular'} className="rotate-180" />
            </button>
          </div>
        </header>

        {error && (
          <div className="flex items-center justify-between gap-3 border-b border-accent-rose/30 border-l-2 border-l-accent-rose bg-accent-rose/[0.06] px-4 py-2">
            <p className="flex items-center gap-2 text-xs text-accent-rose">
              <WarningCircle size={15} weight="bold" /> {error}
            </p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              dismiss
            </button>
          </div>
        )}

        <ChatPanel
          turns={turns}
          activeTurnId={activeTurn?.id ?? null}
          activeType={activeDiagram?.type ?? null}
          onSelectDiagram={(turnId, type) => {
            setActiveTurnId(turnId);
            setActiveType(type);
          }}
          displayName={displayName}
          onSelectTemplate={handleSelectTemplate}
        />

        <Composer
          catalogue={catalogue}
          selected={selectedTypes}
          onSelectedChange={setSelectedTypes}
          onSend={(prompt) => void handleSend(prompt)}
          onStop={stop}
          busy={busy}
          isRevision={isRevision}
          disabled={status === 'unreachable'}
        />
      </main>

      {/* Right Diagram Inspection Canvas Pane */}
      {diagramPaneOpen && (
        <DiagramPane
          sessionId={activeId}
          diagram={activeDiagram}
          version={displayTurn?.version ?? null}
          catalogue={catalogue}
          displayName={displayName}
          onSwitchView={(type) => void handleSwitchView(type)}
          switching={switching}
          lastSwitchCost={lastSwitchCost}
        />
      )}
    </div>
  );
}

export default App;
