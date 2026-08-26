import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { DiagramPayload } from '../types/uml';

/**
 * A rendered diagram, shown as an image.
 *
 * The SVG fallback goes through a blob URL in an `<img>` rather than
 * `dangerouslySetInnerHTML`: the markup is generated from model text, and an
 * `<img>` neither runs script nor lets the diagram reach into the page.
 */
function useSvgUrl(svg: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!svg) {
      setUrl(null);
      return;
    }
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [svg]);

  return url;
}

export function DiagramView({ diagram }: { diagram: DiagramPayload }) {
  const svgUrl = useSvgUrl(diagram.pngUrl ? null : diagram.svg);

  // 'projected' means the source exists but the renderer has not seen it yet.
  if (diagram.status === 'projected') {
    return (
      <div className="diagram-canvas flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-line bg-bg-secondary/40 p-8">
        <Loader2 size={20} className="animate-spin text-accent-indigo" />
        <p className="text-sm text-text-secondary">Rendering diagram…</p>
        <p className="text-xs text-text-muted">Source is ready — the renderer is running.</p>
      </div>
    );
  }

  const src = diagram.pngUrl ?? svgUrl;

  return (
    <div className="flex flex-col gap-3">
      {src ? (
        <div className="diagram-canvas overflow-x-auto rounded-lg border border-line bg-white p-4">
          <img src={src} alt={`${diagram.type} diagram`} className="mx-auto block max-w-full" />
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-lg border border-line bg-bg-secondary/60 p-4 font-mono text-xs leading-relaxed text-text-secondary">
          {diagram.source}
        </pre>
      )}

      {diagram.valid === false && diagram.errors.length > 0 && (
        <div className="rounded-lg border border-accent-rose/40 bg-accent-rose/10 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-accent-rose">
            <AlertTriangle size={15} />
            PlantUML rejected this diagram
          </p>
          <ul className="mt-2 space-y-1">
            {diagram.errors.map((error, index) => (
              <li key={index} className="font-mono text-xs text-text-secondary">
                {error.line !== null && <span className="text-accent-amber">line {error.line}: </span>}
                {error.message}
              </li>
            ))}
          </ul>
          {diagram.repairAttempts > 0 && (
            <p className="mt-2 text-xs text-text-muted">
              {diagram.repairAttempts} automatic repair attempt
              {diagram.repairAttempts === 1 ? '' : 's'} did not fix it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
