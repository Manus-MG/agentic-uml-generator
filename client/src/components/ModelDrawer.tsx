import { useEffect, useMemo, useState } from 'react';
import {
  CaretDown,
  CaretRight,
  Check,
  Copy,
  Cpu,
  Database,
  MagnifyingGlass,
  Sparkle,
  TreeStructure,
} from '@phosphor-icons/react';
import { api } from '../services/api';
import type { CanonicalModelResponse } from '../types/uml';

function JsonNode({
  title,
  data,
  depth = 0,
}: {
  title: string;
  data: unknown;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (data === null || data === undefined) {
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs font-mono">
        <span className="text-accent-indigo">{title}:</span>
        <span className="text-text-muted">null</span>
      </div>
    );
  }

  if (typeof data !== 'object') {
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs font-mono">
        <span className="text-accent-indigo">{title}:</span>
        <span className={typeof data === 'string' ? 'text-accent-emerald' : 'text-accent-amber'}>
          {JSON.stringify(data)}
        </span>
      </div>
    );
  }

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  const count = isArray ? (data as unknown[]).length : keys.length;

  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs font-mono text-text-secondary hover:bg-bg-tertiary/60"
      >
        {open ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
        <span className="font-semibold text-text-primary">{title}</span>
        <span className="rounded bg-bg-tertiary px-1 py-0.2 text-[10px] text-text-muted">
          {isArray ? `[${count}]` : `{${count}}`}
        </span>
      </button>

      {open && (
        <div className="ml-3 border-l border-line/60 pl-2">
          {isArray
            ? (data as unknown[]).map((item, idx) => (
                <JsonNode key={idx} title={`#${idx}`} data={item} depth={depth + 1} />
              ))
            : keys.map((key) => (
                <JsonNode
                  key={key}
                  title={key}
                  data={(data as Record<string, unknown>)[key]}
                  depth={depth + 1}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export function ModelDrawer({
  sessionId,
  version,
}: {
  sessionId: string;
  version: number | null;
}) {
  const [model, setModel] = useState<CanonicalModelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getCanonicalModel(sessionId, version ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setModel(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, version]);

  const copyJson = () => {
    if (!model) return;
    navigator.clipboard.writeText(JSON.stringify(model.csm, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const csmRecord = model?.csm as Record<string, unknown> | undefined;

  const filteredCsm = useMemo(() => {
    if (!csmRecord || !search.trim()) return csmRecord;
    const query = search.toLowerCase();
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(csmRecord)) {
      if (k.toLowerCase().includes(query) || JSON.stringify(v).toLowerCase().includes(query)) {
        result[k] = v;
      }
    }
    return result;
  }, [csmRecord, search]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-xs text-text-muted">
        <Cpu size={20} className="animate-spin text-accent-indigo" />
        <span>Loading Canonical System Model AST…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-accent-rose/30 bg-accent-rose/10 p-4 text-xs text-accent-rose">
        <p className="font-semibold">Unable to load canonical model</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  if (!model) return null;

  return (
    <div className="space-y-3">
      {/* Top Controls & View Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-bg-primary p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'tree'
                ? 'bg-accent-indigo/20 text-accent-indigo'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <TreeStructure size={14} /> AST Explorer
          </button>
          <button
            type="button"
            onClick={() => setViewMode('raw')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'raw'
                ? 'bg-accent-indigo/20 text-accent-indigo'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Database size={14} /> Raw JSON
          </button>
        </div>

        <button
          type="button"
          onClick={copyJson}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-bg-secondary px-2.5 py-1 text-xs text-text-secondary transition hover:border-line-hover hover:text-text-primary"
        >
          {copied ? <Check size={12} weight="bold" className="text-accent-emerald" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy AST'}
        </button>
      </div>

      {/* Model Rationale */}
      {model.rationale && (
        <div className="rounded-lg border border-line/60 bg-bg-primary p-2.5 text-xs text-text-secondary">
          <div className="mb-1 flex items-center gap-1 font-semibold text-text-primary">
            <Sparkle size={13} weight="fill" className="text-accent-indigo" /> Architectural Rationale
          </div>
          <p className="italic text-text-muted leading-relaxed">{model.rationale}</p>
        </div>
      )}

      {/* Search Input for AST */}
      {viewMode === 'tree' && (
        <div className="relative">
          <MagnifyingGlass size={13} className="absolute top-2.5 left-2.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AST entities, slices, or properties…"
            className="w-full rounded-lg border border-line bg-bg-primary py-1.5 pr-3 pl-7 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-indigo focus:outline-none"
          />
        </div>
      )}

      {/* Tree or Raw JSON Viewer */}
      {viewMode === 'tree' ? (
        <div className="rounded-lg border border-line bg-bg-primary p-3">
          {filteredCsm && Object.keys(filteredCsm).length > 0 ? (
            Object.entries(filteredCsm).map(([key, value]) => (
              <JsonNode key={key} title={key} data={value} depth={0} />
            ))
          ) : (
            <p className="text-xs text-text-muted">No matching AST nodes found.</p>
          )}
        </div>
      ) : (
        <pre className="max-h-96 overflow-auto rounded-lg border border-line bg-bg-primary p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
          {JSON.stringify(model.csm, null, 2)}
        </pre>
      )}
    </div>
  );
}


