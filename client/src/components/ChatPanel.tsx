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
    badge: 'Project brief',
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
    badge: 'Fintech',
    desc: 'Command & query segregation with Kafka event streams, Redis cache read-models, and idempotent payment webhooks.',
    prompt: `Design a high-throughput Event-Driven CQRS payment system. It accepts Order Placed commands, publishes events to a distributed Kafka broker, updates read-optimized view stores in Redis, and communicates asynchronously with Payment Gateways with exponential retry and dead-letter queue.`,
    types: ['sequence', 'component', 'state_machine'],
    icon: Lightning,
  },
  {
    id: 'zero-trust-auth',
    title: 'Zero-Trust OAuth2 & API Gateway',
    badge: 'Security',
    desc: 'OIDC token verification, role-based access control, distributed rate limiting, and microservice mTLS mesh.',
    prompt: `Design a Zero-Trust API Gateway and Authentication Service. Clients authenticate via OAuth2/OIDC, receiving access & refresh tokens. The gateway enforces rate limiting using Redis sliding-window, validates JWT claims, and routes to internal microservices over mTLS.`,
    types: ['sequence', 'component', 'deployment'],
    icon: ShareNetwork,
  },
  {
    id: 'crdt-collab',
    title: 'Real-time Collaborative Canvas',
    badge: 'Realtime',
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
      <div className="blueprint-grid relative flex flex-1 flex-col items-center justify-start overflow-y-auto p-6 sm:p-10">
        {/* Hero */}
        <div className="relative z-10 max-w-2xl text-center pt-4">
          <div className="inline-flex items-center gap-2 rounded-sm border border-line-active/40 bg-bg-secondary px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-accent-orange">
            <Sparkle size={12} weight="fill" />
            <span>Architecture synthesis studio</span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-text-primary sm:text-5xl">
            Describe the system.
            <br />
            <span className="text-accent-orange">Get the blueprint.</span>
          </h1>

          <p className="mt-4 text-xs text-text-secondary leading-relaxed sm:text-sm max-w-xl mx-auto">
            Fourteen UML 2.x projections generated from a single canonical system model — verified against
            PlantUML, patched incrementally, and re-projected at zero extra cost.
          </p>
        </div>

        {/* Blueprint Starter Gallery */}
        <div className="relative z-10 mt-9 w-full max-w-3xl space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <p className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-text-muted uppercase tracking-wider">
              <Cpu size={13} className="text-accent-orange" />
              <span>Starter blueprints</span>
            </p>
            <span className="text-[10px] font-mono text-text-muted">select one</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ARCHITECTURE_BLUEPRINTS.map((bp) => {
              const Icon = bp.icon;
              return (
                <button
                  key={bp.id}
                  type="button"
                  onClick={() => onSelectTemplate?.(bp.prompt, bp.types)}
                  className="card-interactive group flex flex-col justify-between rounded-sm p-4 text-left cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                        <Icon size={15} weight="bold" className="text-accent-orange shrink-0" />
                        {bp.title}
                      </span>
                      <span className="shrink-0 rounded-sm border border-line px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide text-text-muted">
                        {bp.badge}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-text-muted line-clamp-2 leading-relaxed">
                      {bp.desc}
                    </p>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-t border-line pt-2.5 text-[11px] text-text-muted">
                    <div className="flex flex-wrap gap-1">
                      {bp.types.map((t) => (
                        <span
                          key={t}
                          className="rounded-sm border border-line bg-bg-primary px-1.5 py-0.5 font-mono text-[10px] text-text-secondary"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="flex items-center gap-1 text-accent-orange font-medium text-xs group-hover:translate-x-0.5 transition-transform">
                      Run <ArrowRight size={13} weight="bold" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spec sheet stats */}
        <div className="relative z-10 mt-10 grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-line pt-6 text-center font-mono">
          <div>
            <p className="text-xl font-semibold text-accent-orange sm:text-2xl">14+</p>
            <p className="text-[10px] uppercase tracking-wide text-text-muted mt-0.5">UML 2.x projections</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-text-primary sm:text-2xl">1</p>
            <p className="text-[10px] uppercase tracking-wide text-text-muted mt-0.5">Canonical model</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-accent-emerald sm:text-2xl">100%</p>
            <p className="text-[10px] uppercase tracking-wide text-text-muted mt-0.5">Syntax verified</p>
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
