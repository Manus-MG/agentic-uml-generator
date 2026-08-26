import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  Cpu,
  Lightning,
  ShareNetwork,
  ShieldCheck,
  Sparkle,
  TreeStructure,
} from '@phosphor-icons/react';
import { ChatTurn } from './ChatTurn';
import type { Turn } from '../hooks/useChat';

const ARCHITECTURE_BLUEPRINTS = [
  {
    id: 'sebi-compliance',
    title: 'SEBI Compliance Monitoring Engine',
    badge: 'Project Brief Spec',
    desc: 'Automated circular ingestion, clause parser, gap analysis against existing setup, and IT/Ops organizational impact matrix.',
    prompt: `I am working on a compliance monitoring solution which will pull in the latest circulars from SEBI and parse them. Once it is parsed into a table of clauses, extract:
1. The new compliance requirements proposed by the regulator
2. Gap analysis with my existing compliance setup
3. The impact of these new compliance requirements on my organization at an IT and operational level`,
    types: ['sequence', 'component', 'class', 'activity'],
    icon: ShieldCheck,
  },
  {
    id: 'event-cqrs',
    title: 'Event-Driven CQRS & Payment Engine',
    badge: 'Enterprise FinTech',
    desc: 'Command & Query segregation with Kafka event streams, Redis cache read-models, and idempotent payment webhooks.',
    prompt: `Design a high-throughput Event-Driven CQRS payment system. It accepts Order Placed commands, publishes events to a distributed Kafka broker, updates read-optimized view stores in Redis, and communicates asynchronously with Payment Gateways with exponential retry and dead-letter queue.`,
    types: ['sequence', 'component', 'state_machine'],
    icon: Lightning,
  },
  {
    id: 'zero-trust-auth',
    title: 'Zero-Trust OAuth2 & API Gateway',
    badge: 'Security & Cloud',
    desc: 'OIDC token verification, role-based access control, distributed rate limiting, and microservice mTLS mesh.',
    prompt: `Design a Zero-Trust API Gateway and Authentication Service. Clients authenticate via OAuth2/OIDC, receiving access & refresh tokens. The gateway enforces rate limiting using Redis sliding-window, validates JWT claims, and routes to internal microservices over mTLS.`,
    types: ['sequence', 'component', 'deployment'],
    icon: ShareNetwork,
  },
  {
    id: 'crdt-collab',
    title: 'Real-time Collaborative Canvas',
    badge: 'WebSockets & CRDT',
    desc: 'Bi-directional WebSocket synchronizer with CRDT conflict resolution, presence indicators, and snapshot workers.',
    prompt: `Design a real-time collaborative document whiteboard system. Clients connect via WebSocket Gateway, broadcast local change operations, resolve concurrent conflicts using CRDTs (Conflict-free Replicated Data Types), and persist delta snapshots to S3.`,
    types: ['sequence', 'component', 'class'],
    icon: TreeStructure,
  },
];

export function ChatPanel({
  turns,
  activeTurnId,
  activeType,
  onSelectDiagram,
  displayName,
  onSelectTemplate,
}: {
  turns: Turn[];
  activeTurnId: string | null;
  activeType: string | null;
  onSelectDiagram: (turnId: string, type: string) => void;
  displayName: (id: string) => string;
  onSelectTemplate?: (prompt: string, types: string[]) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length]);

  if (turns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-start overflow-y-auto p-6 sm:p-10">
        {/* Studio Hero Header */}
        <div className="max-w-2xl text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-indigo text-white shadow-lg">
            <Sparkle size={28} weight="fill" />
          </div>

          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-text-primary sm:text-2xl">
            Autonomous UML Architecture Studio
          </h1>
          <p className="mt-2 text-xs text-text-secondary leading-relaxed sm:text-sm">
            Synthesize all 14 UML 2.x diagram projections from a single canonical system AST model.
            Slices are verified by PlantUML with auto-repair and zero-cost multi-view projections.
          </p>
        </div>

        {/* Blueprint Starter Gallery */}
        <div className="mt-8 w-full max-w-3xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
              <Cpu size={14} weight="bold" className="text-accent-indigo" />
              <span>Architectural Blueprint Templates (1-Click Start)</span>
            </p>
            <span className="text-[11px] text-text-muted">Click any card to load</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ARCHITECTURE_BLUEPRINTS.map((bp) => {
              const Icon = bp.icon;
              return (
                <button
                  key={bp.id}
                  type="button"
                  onClick={() => onSelectTemplate?.(bp.prompt, bp.types)}
                  className="solid-card-interactive group flex flex-col justify-between rounded-xl p-4 text-left cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-text-primary group-hover:text-accent-indigo transition-colors">
                        <Icon size={16} weight="bold" className="text-accent-indigo" />
                        {bp.title}
                      </span>
                      <span className="rounded bg-accent-indigo/15 px-1.5 py-0.2 text-[9px] font-mono text-accent-indigo">
                        {bp.badge}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {bp.desc}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line/50 pt-2 text-[11px] text-text-muted">
                    <span className="font-mono text-[10px] text-text-secondary">
                      {bp.types.join(' · ')}
                    </span>
                    <span className="flex items-center gap-1 text-accent-indigo font-medium group-hover:translate-x-0.5 transition-transform">
                      Synthesize <ArrowRight size={12} weight="bold" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
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


