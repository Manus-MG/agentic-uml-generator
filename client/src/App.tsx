import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
import { ChatPanel } from './components/ChatPanel';
import { Composer } from './components/Composer';
import { DiagramPane } from './components/DiagramPane';
import { SessionSidebar } from './components/SessionSidebar';
import { useChat } from './hooks/useChat';
import { useDiagramTypes } from './hooks/useDiagramTypes';
import { useFeedback } from './hooks/useFeedback';
import { useHealth } from './hooks/useHealth';
import { useSessions } from './hooks/useSessions';
import { api } from './services/api';

/**
 * The chat platform from the brief.
 *
 * Three panes: the sessions this backend still holds, the conversation, and the
 * diagram currently under discussion. All three cases the brief asks for run
 * through the same conversation — a first prompt generates, a later prompt on
 * the same session revises, and every diagram carries the rating control that
 * feeds the RL trainer.
 */
export function App() {
  const { sessions, activeId, setActiveId, startNew, remove, refresh } = useSessions();
  const { catalogue, displayName } = useDiagramTypes();
  const { health, status } = useHealth();
  const { turns, busy, send, stop, addView } = useChat(activeId);
  const { known: knownRatings, record: recordRating } = useFeedback(activeId);

  const [selectedTypes, setSelectedTypes] = useState<string[]>(['sequence', 'component', 'class']);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [lastSwitchCost, setLastSwitchCost] = useState<{ type: string; llmCalls: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTurn = useMemo(
    () => turns.find((turn) => turn.id === activeTurnId) ?? turns[turns.length - 1] ?? null,
    [turns, activeTurnId],
  );

  /**
   * The diagram in the right-hand pane.
   *
   * While a new turn is still streaming it has no diagrams yet, and blanking
   * the pane at exactly that moment is the worst time to do it — so the last
   * turn that produced something stays on screen until the new one has output.
   */
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

  // Follow the newest turn as its diagrams arrive, until the user picks one.
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
    // `activeType` is deliberately not a dependency: reacting to it here would
    // undo the user's own tab choice on the next render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, activeTurnId]);

  /**
   * There is always an active id, even before anything is sent.
   *
   * Minting it at send time instead would leave the send closure holding the
   * old null id, and the message would go nowhere. Nothing is written to the
   * backend until the first turn, so an unused id costs nothing.
   */
  useEffect(() => {
    if (!activeId) startNew();
  }, [activeId, startNew]);

  const isRevision = turns.length > 0;

  const handleSend = useCallback(
    async (prompt: string) => {
      setError(null);
      await send(prompt, selectedTypes);
      await refresh();
    },
    [send, selectedTypes, refresh],
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

  /** The sidebar asks for confirmation inline before calling this. */
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

  return (
    <div className="flex h-full">
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
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-accent-indigo to-accent-violet">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-text-primary">UML Architecture Chat</h1>
            <p className="truncate text-[11px] text-text-muted">
              {activeId ? `Session ${activeId}` : 'No session — send a message to start one'}
            </p>
          </div>
        </header>

        {error && (
          <div className="flex items-center justify-between gap-3 border-b border-accent-rose/40 bg-accent-rose/10 px-4 py-2">
            <p className="flex items-center gap-2 text-xs text-accent-rose">
              <AlertCircle size={14} /> {error}
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

      <DiagramPane
        sessionId={activeId}
        diagram={activeDiagram}
        version={displayTurn?.version ?? null}
        catalogue={catalogue}
        displayName={displayName}
        onSwitchView={(type) => void handleSwitchView(type)}
        switching={switching}
        lastSwitchCost={lastSwitchCost}
        knownRating={activeDiagram?.diagramId ? knownRatings.get(activeDiagram.diagramId) : undefined}
        onRated={recordRating}
      />
    </div>
  );
}

export default App;
