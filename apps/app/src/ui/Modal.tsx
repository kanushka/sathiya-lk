// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { IconButton } from './IconButton';
import { PHONE_QUERY, useMediaQuery } from './PhoneNotice';
import { useDialogTrap } from './useDialogTrap';

export interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  width?: number;
  zoom?: number;
  busy?: boolean;
  fullScreen?: boolean;
  closeLabel?: string;
  children: ReactNode;
}

export function Modal(props: ModalProps) {
  if (!props.open) return null;
  return createPortal(<ModalPanel {...props} />, document.body);
}

function ModalPanel({ title, subtitle, onClose, footer, width = 560, zoom, busy = false, fullScreen = false, closeLabel, children }: ModalProps) {
  const { t } = useTranslation('shell');
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = busy ? () => undefined : onClose;

  const isPhone = useMediaQuery(PHONE_QUERY);
  useDialogTrap({
    panelRef,
    containerRef: backdropRef,
    initialFocusRef: bodyRef,
    focusPanel: isPhone && !fullScreen,
    onClose: () => onCloseRef.current(),
  });

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
      ref={backdropRef}
      data-testid="modal-backdrop"
      style={zoom && zoom !== 1 ? { zoom } : undefined}
      className={cx(
        'fixed inset-0 z-50 flex',
        fullScreen ? 'bg-white' : 'items-end justify-center overflow-y-auto bg-navy/45 md:items-center md:p-8',
      )}
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
        style={fullScreen ? undefined : { maxWidth: width }}
        className={cx(
          'flex w-full flex-col overflow-hidden bg-white outline-none',
          fullScreen
            ? 'h-full pb-[env(safe-area-inset-bottom)]'
            : 'max-h-[90dvh] rounded-t-[18px] pb-[env(safe-area-inset-bottom)] shadow-[0_30px_80px_-30px_rgba(20,33,61,.6)] md:my-auto md:max-h-[calc(100vh-2rem)] md:rounded-[18px] md:pb-0',
        )}
      >
        <header className={cx('flex items-center justify-between gap-4 border-b border-line-soft', fullScreen ? 'px-4 py-3' : 'px-5 py-4 md:px-7 md:py-5')}>
          <div className="min-w-0">
            <h2 id={titleId} className={cx('m-0 font-bold text-ink', fullScreen ? 'truncate text-base' : 'text-xl')}>
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
          </div>
          <IconButton
            icon="close"
            label={closeLabel ?? t('modal.close')}
            variant="subtle"
            disabled={busy}
            onClick={onClose}
            className={fullScreen ? 'h-11 w-11 shrink-0' : undefined}
          />
        </header>
        <div ref={bodyRef} className={cx('min-h-0 flex-1 overflow-y-auto', !fullScreen && 'px-5 py-5 md:px-7 md:py-6')}>
          {children}
        </div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-surface px-5 py-3 md:px-7 md:py-4">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
