import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * A render error in one diagram should not take the whole chat with it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold text-text-primary">Something broke in the UI</h1>
        <p className="max-w-md font-mono text-xs text-accent-rose">{this.state.error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-card-hover"
        >
          Reload
        </button>
      </div>
    );
  }
}
