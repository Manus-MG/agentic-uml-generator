import { useEffect, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowsIn,
  ArrowsOut,
  CircleNotch,
  Copy,
  DownloadSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Moon,
  Sun,
  Warning,
} from '@phosphor-icons/react';
import type { DiagramPayload } from '../types/uml';

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
  const src = diagram.pngUrl ?? svgUrl;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [canvasTheme, setCanvasTheme] = useState<'light' | 'dark'>('light');
  const [isLightbox, setIsLightbox] = useState(false);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Reset pan/zoom when diagram changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [diagram.diagramId, diagram.type]);

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, z - 0.25));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPos({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const copySource = () => {
    if (!diagram.source) return;
    navigator.clipboard.writeText(diagram.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadImage = (type: 'png' | 'svg') => {
    if (type === 'svg' && diagram.svg) {
      const blob = new Blob([diagram.svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${diagram.type}-diagram.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (src) {
      const a = document.createElement('a');
      a.href = src;
      a.download = `${diagram.type}-diagram.png`;
      a.click();
    }
  };

  if (diagram.status === 'projected') {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-sm border border-line bg-bg-secondary p-8 text-center">
        <CircleNotch size={24} className="animate-spin text-accent-orange" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Rendering via PlantUML…</p>
          <p className="mt-1 text-xs text-text-muted">
            Model slice synthesized. Compiling vector output.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Floating Canvas Control Toolbar */}
      {src && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line bg-bg-primary px-3 py-1.5">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In"
              className="rounded-sm p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              <MagnifyingGlassPlus size={15} />
            </button>
            <span className="min-w-10 text-center font-mono text-[11px] text-text-muted">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out"
              className="rounded-sm p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              <MagnifyingGlassMinus size={15} />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset View"
              className="rounded-sm p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              <ArrowCounterClockwise size={14} />
            </button>
          </div>

          {/* Theme, Copy, Export, Lightbox */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCanvasTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              title={`Switch to ${canvasTheme === 'light' ? 'dark' : 'light'} canvas`}
              className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              {canvasTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              <span className="text-[11px] capitalize">{canvasTheme}</span>
            </button>

            <span className="text-line">|</span>

            <button
              type="button"
              onClick={copySource}
              title="Copy PlantUML Code"
              className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              <Copy size={13} />
              <span className="text-[11px]">{copied ? 'Copied' : 'Copy PUML'}</span>
            </button>

            <button
              type="button"
              onClick={() => downloadImage(diagram.svg ? 'svg' : 'png')}
              title="Download Vector Graphic"
              className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              <DownloadSimple size={13} />
              <span className="text-[11px]">{diagram.svg ? 'SVG' : 'PNG'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLightbox(true)}
              title="Fullscreen"
              className="rounded-sm p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            >
              <ArrowsOut size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Diagram Canvas */}
      {src ? (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative min-h-[380px] max-h-[550px] overflow-hidden rounded-sm border border-line p-4 transition-colors ${
            canvasTheme === 'dark' ? 'bg-[#0b0e13]' : 'bg-slate-100'
          } ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.15s ease-out',
            }}
            className={`flex items-center justify-center ${
              canvasTheme === 'dark' ? 'diagram-canvas-dark' : 'diagram-canvas-light'
            }`}
          >
            <img
              src={src}
              alt={`${diagram.type} diagram`}
              draggable={false}
              className="max-h-[500px] select-none object-contain"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-line bg-bg-primary p-4">
          <p className="mb-2 text-xs font-semibold text-text-muted">PlantUML source:</p>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-text-secondary">
            {diagram.source}
          </pre>
        </div>
      )}

      {/* Syntax Error Box */}
      {diagram.valid === false && diagram.errors.length > 0 && (
        <div className="rounded-sm border border-accent-rose/40 border-l-2 border-l-accent-rose bg-accent-rose/[0.06] p-3.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-accent-rose">
            <Warning size={15} weight="bold" />
            PlantUML syntax validation failed
          </p>
          <ul className="mt-2 space-y-1">
            {diagram.errors.map((error, index) => (
              <li key={index} className="font-mono text-xs text-text-primary">
                {error.line !== null && <span className="font-bold text-accent-amber">line {error.line}: </span>}
                {error.message}
              </li>
            ))}
          </ul>
          {diagram.repairAttempts > 0 && (
            <p className="mt-2 text-[11px] text-text-muted">
              {diagram.repairAttempts} auto-repair pass{diagram.repairAttempts === 1 ? '' : 'es'} were executed.
            </p>
          )}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {isLightbox && src && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg-primary">
          {/* Lightbox Header */}
          <div className="flex items-center justify-between border-b border-line px-6 py-3 bg-bg-secondary">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary capitalize">{diagram.type} diagram</span>
              <span className="rounded-sm bg-bg-tertiary px-2 py-0.5 text-xs text-text-muted">Fullscreen</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCanvasTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                className="flex items-center gap-1 rounded-sm border border-line px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              >
                {canvasTheme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                <span className="capitalize">{canvasTheme}</span>
              </button>

              <button
                type="button"
                onClick={() => downloadImage(diagram.svg ? 'svg' : 'png')}
                className="flex items-center gap-1.5 rounded-sm border border-line-active/40 bg-accent-orange px-3 py-1.5 text-xs font-semibold text-bg-primary hover:bg-accent-orange-hover"
              >
                <DownloadSimple size={14} /> Download {diagram.svg ? 'SVG' : 'PNG'}
              </button>

              <button
                type="button"
                onClick={() => setIsLightbox(false)}
                className="rounded-sm border border-line p-1.5 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              >
                <ArrowsIn size={16} />
              </button>
            </div>
          </div>

          {/* Lightbox Pan Canvas */}
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`flex flex-1 items-center justify-center overflow-hidden p-8 ${
              canvasTheme === 'dark' ? 'bg-[#080b10]' : 'bg-slate-200'
            } ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: isPanning ? 'none' : 'transform 0.15s ease-out',
              }}
              className={canvasTheme === 'dark' ? 'diagram-canvas-dark' : 'diagram-canvas-light'}
            >
              <img
                src={src}
                alt={`${diagram.type} diagram`}
                draggable={false}
                className="max-h-[85vh] select-none object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
