'use client';

import { useCallback, useEffect, useRef } from 'react';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'default';

export interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: ConfirmDialogVariant;
}

const variantButtonClass: Record<ConfirmDialogVariant, string> = {
  danger: 'button danger',
  warning: 'button confirm-dialog-warning-btn',
  default: 'button primary',
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap: focus the dialog on mount
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    confirmBtnRef.current?.focus();

    return () => {
      prev?.focus?.();
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Focus trap: keep focus within the dialog
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    []
  );

  return (
    <div
      className="confirm-dialog-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h3>
        <p id="confirm-dialog-description" className="confirm-dialog-description">
          {description}
        </p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={variantButtonClass[variant]}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
