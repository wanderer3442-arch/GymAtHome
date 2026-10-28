'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

// --- Module-level store ---------------------------------------------------
// Toasts must be shared between whoever calls showToast() (e.g. store-context)
// and the <ToastNotification /> renderer mounted in the root layout. Keeping
// the list outside React state of any single component makes both sides see
// the same queue.
let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Toast[] {
  return toasts;
}

function removeToast(id: string) {
  toasts = toasts.filter((toast) => toast.id !== id);
  notify();
}

/**
 * Show a toast. Works from anywhere - the message is rendered by the
 * <ToastNotification /> instance mounted in the root layout.
 */
export function showToast(
  message: string,
  type: Toast['type'] = 'info',
  duration = 4000
): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  toasts = [...toasts, { id, message, type }];
  notify();

  if (duration > 0) {
    window.setTimeout(() => removeToast(id), duration);
  }
  return id;
}

/** Hook form of showToast - stable identity, safe to use in deps. */
export function useToast() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const dismiss = useCallback((id: string) => removeToast(id), []);

  return { toasts: list, showToast, removeToast: dismiss };
}

// --- Renderer -------------------------------------------------------------
const typeStyles: Record<Toast['type'], string> = {
  success: 'bg-success text-white',
  error: 'bg-error text-on-error',
  warning: 'bg-warning text-white',
  info: 'bg-surface-container text-on-surface',
};

const typeIcons: Record<Toast['type'], LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function ToastNotification() {
  const { toasts, removeToast } = useToast();

  // Dismiss on click (in addition to auto-close handled in showToast).
  const handleDismiss = useCallback(
    (id: string) => removeToast(id),
    [removeToast]
  );

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-5 right-5 z-[9999] flex flex-col items-end gap-3 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = typeIcons[toast.type];
        return (
          <div
            key={toast.id}
            onClick={() => handleDismiss(toast.id)}
            className={`pointer-events-auto p-4 rounded-2xl shadow-lg max-w-sm cursor-pointer ${typeStyles[toast.type]}`}
          >
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
              <p className="font-medium text-sm leading-relaxed">{toast.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
