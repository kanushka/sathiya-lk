// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { IconButton } from './IconButton';

export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  width?: number;
  zoom?: number;
  busy?: boolean;
  children: ReactNode;
}

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: symbol[] = [];

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(focusable)).filter((el) => !el.closest('[data-menu-panel]'));
}

export function Modal(props: ModalProps) {
  if (!props.open) return null;
  return createPortal(<ModalPanel {...props} />, document.body);
}

function ModalPanel({ title, subtitle, onClose, footer, width = 560, zoom, busy = false, children }: ModalProps) {
  const { t } = useTranslation('shell');
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = busy ? () => undefined : onClose;

  useEffect(() => {
    const id = Symbol('modal');
    stack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = (bodyRef.current && focusables(bodyRef.current)[0]) ?? (panel && focusables(panel)[0]) ?? panel;
    first?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== id || !panel) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(panel);
      const head = items[0];
      const tail = items[items.length - 1];
      if (!head || !tail) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const active = document.activeElement;
      if (e.shiftKey && (active === head || !panel.contains(active))) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && (active === tail || !panel.contains(active))) {
        e.preventDefault();
        head.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      stack.splice(stack.indexOf(id), 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // A loading button is disabled, which drops focus to <body>; keep it in the dialog.
  useEffect(() => {
    const panel = panelRef.current;
    if (busy && panel && !panel.contains(document.activeElement)) panel.focus();
  }, [busy]);

  const onBackdropDown = (e: MouseEvent) => {
    pressedOnBackdrop.current = e.target === e.currentTarget;
  };
  const onBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget && pressedOnBackdrop.current) onCloseRef.current();
    pressedOnBackdrop.current = false;
  };

  return (
    <div
      data-testid="modal-backdrop"
      style={zoom && zoom !== 1 ? { zoom } : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy/45 p-4 sm:p-8"
      onMouseDown={onBackdropDown}
      onClick={onBackdropClick}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-busy={busy || undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: width }}
        className="my-auto flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_-30px_rgba(20,33,61,.6)] outline-none"
      >
        <header className="flex items-center justify-between gap-4 border-b border-line-soft px-7 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="m-0 text-xl font-bold text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
          </div>
          <IconButton
            icon="close"
            label={t('modal.close')}
            variant="subtle"
            disabled={busy}
            onClick={onClose}
          />
        </header>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {children}
        </div>
        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-line-soft bg-surface px-7 py-4">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
