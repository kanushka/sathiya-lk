// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

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

const kindBadge: Record<ToastKind, string> = {
  info: 'bg-surface-3 text-navy',
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
};

function ToastBadge({ kind }: { kind: ToastKind }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        kindBadge[kind],
      )}
    >
      {kind === 'success' ? <Icon name="check" size={12} strokeWidth={2.5} /> : kind === 'error' ? '!' : 'i'}
    </span>
  );
}

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
      className="pointer-events-none fixed left-1/2 top-[4.5rem] z-[60] md:bottom-4 md:top-auto flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-white py-3 pl-4 pr-2 text-sm text-ink shadow-[0_14px_30px_-18px_rgba(20,33,61,.5)]"
        >
          <ToastBadge kind={toast.kind} />
          <p className="flex-1 pt-px">{toast.message}</p>
          <IconButton
            icon="close"
            label={t('toast.close')}
            size="sm"
            variant="ghost"
            onClick={() => onDismiss(toast.id)}
            className="-my-1.5"
          />
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
