import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { ChatTurn } from './ChatTurn';
import type { Turn } from '../hooks/useChat';

export function ChatPanel({
  turns,
  activeTurnId,
  activeType,
  onSelectDiagram,
  displayName,
}: {
  turns: Turn[];
  activeTurnId: string | null;
  activeType: string | null;
  onSelectDiagram: (turnId: string, type: string) => void;
  displayName: (id: string) => string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length]);

  if (turns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-accent-indigo to-accent-violet">
          <Sparkles size={22} className="text-white" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Describe a system</h2>
        <p className="max-w-md text-sm text-text-secondary">
          Every diagram is projected from one canonical model, so the participants in a sequence
          diagram are the same components in the component diagram. Send a follow-up message to
          revise the model — only the views it touches are re-rendered.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
      {turns.map((turn) => (
        <ChatTurn
          key={turn.id}
          turn={turn}
          isActive={turn.id === activeTurnId}
          activeType={activeType}
          onSelectDiagram={onSelectDiagram}
          displayName={displayName}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
