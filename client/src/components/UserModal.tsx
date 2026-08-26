import { useState, useMemo, useEffect, useRef } from 'react';
import {
  UserCircle,
  UserPlus,
  ArrowRight,
  Sparkle,
  ClockCounterClockwise,
  X,
  CheckCircle,
} from '@phosphor-icons/react';
import type { UserProfile } from '../types/uml';

interface UserModalProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  knownUsers: UserProfile[];
  onIdentify: (name: string) => Promise<unknown>;
  onSelectUser: (user: UserProfile) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export function UserModal({
  isOpen,
  currentUser,
  knownUsers,
  onIdentify,
  onSelectUser,
  onClose,
  canDismiss = false,
}: UserModalProps) {
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNameInput('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const matchedUser = useMemo(() => {
    const trimmed = nameInput.trim().toLowerCase();
    if (!trimmed) return null;
    return knownUsers.find((u) => u.name.toLowerCase() === trimmed) ?? null;
  }, [nameInput, knownUsers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) {
      setError('Please enter your name');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onIdentify(clean);
      if (onClose) onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to authenticate user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSelect = (user: UserProfile) => {
    onSelectUser(user);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-sm border border-line bg-bg-secondary p-6 shadow-2xl">
        <span className="corner corner-tl" />
        <span className="corner corner-tr" />
        <span className="corner corner-bl" />
        <span className="corner corner-br" />

        {canDismiss && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-sm p-1.5 text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
            title="Close modal"
          >
            <X size={18} />
          </button>
        )}

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-sm border border-line-active/40 bg-accent-orange text-bg-primary">
            <UserCircle size={22} weight="bold" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-text-primary">
              {currentUser ? 'Switch user workspace' : 'Welcome to Agentic UML Studio'}
            </h2>
            <p className="text-xs text-text-muted">
              {currentUser
                ? `Currently active: ${currentUser.name} (${currentUser.userId})`
                : 'Enter your name to access your workspace or start a new profile.'}
            </p>
          </div>
        </div>

        {/* Name Identification Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="user-name-input" className="block text-[11px] font-mono font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Your name
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="user-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Tony, Alice, Manas…"
                maxLength={60}
                className="w-full rounded-sm border border-line bg-bg-primary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-line-active focus:outline-none transition"
              />
            </div>

            {/* Dynamic Status Preview Badge */}
            {nameInput.trim() && (
              <div className="mt-2 flex items-center gap-2 rounded-sm bg-bg-primary/80 border border-line px-3 py-1.5 text-xs">
                {matchedUser ? (
                  <>
                    <CheckCircle size={14} weight="fill" className="text-accent-emerald shrink-0" />
                    <span className="text-accent-emerald font-medium">Existing user found</span>
                    <span className="text-text-muted font-mono text-[10px]">({matchedUser.userId}) — history will load</span>
                  </>
                ) : (
                  <>
                    <Sparkle size={14} weight="fill" className="text-accent-orange shrink-0" />
                    <span className="text-accent-orange font-medium">New user</span>
                    <span className="text-text-muted font-mono text-[10px]">
                      (usr_{nameInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user'})
                    </span>
                  </>
                )}
              </div>
            )}

            {error && (
              <p className="mt-1.5 text-xs text-accent-rose font-medium">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !nameInput.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-accent-orange py-2.5 px-4 text-xs font-semibold text-bg-primary transition hover:bg-accent-orange-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span>Authenticating…</span>
            ) : matchedUser ? (
              <>
                <span>Continue as {matchedUser.name}</span>
                <ArrowRight size={14} weight="bold" />
              </>
            ) : (
              <>
                <UserPlus size={14} weight="bold" />
                <span>Create profile &amp; start workspace</span>
              </>
            )}
          </button>
        </form>

        {/* Existing Users Quick Select list */}
        {knownUsers.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold tracking-wider text-text-muted uppercase mb-2.5">
              <ClockCounterClockwise size={13} />
              <span>Switch to known user ({knownUsers.length})</span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {knownUsers.map((u) => {
                const isCurrent = currentUser?.userId === u.userId;
                return (
                  <button
                    key={u.userId}
                    type="button"
                    onClick={() => handleQuickSelect(u)}
                    className={`flex w-full items-center justify-between rounded-sm border p-2 text-left transition-colors ${
                      isCurrent
                        ? 'border-line-active/50 bg-accent-orange/10 text-text-primary'
                        : 'border-line bg-bg-primary hover:border-line-hover hover:bg-bg-tertiary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-bg-secondary text-xs font-bold text-accent-orange border border-line">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="truncate text-xs font-semibold">{u.name}</p>
                        <p className="truncate text-[10px] font-mono text-text-muted">{u.userId}</p>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="rounded-sm bg-accent-orange/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent-orange">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
