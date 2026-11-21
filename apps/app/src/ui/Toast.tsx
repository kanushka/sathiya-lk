// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { Icon } from './Icon';

export type ToastKind = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface ToastApi {
  show(message: string, kind?: ToastKind): void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const kindClass: Record<ToastKind, string> = {
  info: 'border-l-navy',
  success: 'border-l-teal',
  error: 'border-l-danger',
};

export function ToastProvider({ children, duration = 4000 }: { children: ReactNode; duration?: number }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, message, kind }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), kind === 'error' ? duration * 2 : duration),
      );
    },
    [dismiss, duration],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(<ToastList toasts={toasts} onDismiss={dismiss} />, document.body)}
    </ToastCtx.Provider>
  );
}

function ToastList({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const { t } = useTranslation('shell');
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cx(
            'pointer-events-auto flex items-start gap-3 rounded-xl border border-l-4 border-line bg-white px-4 py-3 text-sm text-ink shadow-[0_14px_30px_-18px_rgba(20,33,61,.5)]',
            kindClass[toast.kind],
          )}
        >
          <p className="flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('toast.close')}
            title={t('toast.close')}
            className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-slate-100"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
