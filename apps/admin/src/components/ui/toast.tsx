'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastOptions {
  variant: ToastVariant;
  title: string;
  description?: string;
  onRetry?: () => void;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

/* ─── Context ───────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null);

/* ─── Hook ──────────────────────────────────────────────────────── */

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

/* ─── Provider ──────────────────────────────────────────────────── */

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = `toast-${++toastId}`;
    setToasts((prev) => [...prev, { ...options, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <ToastItem key={t.id} entry={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ─── Toast Item ────────────────────────────────────────────────── */

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (entry.variant === 'success' || entry.variant === 'info') {
      timerRef.current = setTimeout(() => onDismiss(entry.id), 5000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [entry.id, entry.variant, onDismiss]);

  return (
    <div className={`toast-item toast-item--${entry.variant}`} role="alert">
      <div className="toast-item-icon">{variantIcon(entry.variant)}</div>
      <div className="toast-item-body">
        <span className="toast-item-title">{entry.title}</span>
        {entry.description && <span className="toast-item-desc">{entry.description}</span>}
      </div>
      <div className="toast-item-actions">
        {entry.variant === 'error' && entry.onRetry && (
          <button className="toast-retry-btn" onClick={entry.onRetry} type="button">
            Retry
          </button>
        )}
        <button
          className="toast-dismiss-btn"
          onClick={() => onDismiss(entry.id)}
          type="button"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────── */

function variantIcon(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
          <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'error':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
          <path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'info':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.15" />
          <path d="M10 9v4M10 6.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}
