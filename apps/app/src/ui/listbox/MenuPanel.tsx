// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx';
import { fieldFocusClass } from '../Field';
import { Icon } from '../Icon';
import type { Placement } from '../popoverPlacement';

export interface MenuPanelProps extends HTMLAttributes<HTMLDivElement> {
  pos: Placement | null;
}

export const MenuPanel = forwardRef<HTMLDivElement, MenuPanelProps>(function MenuPanel(
  { pos, className, style, children, ...rest },
  ref,
) {
  return createPortal(
    <div
      ref={ref}
      {...rest}
      style={{
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: pos?.width,
        opacity: pos ? 1 : 0,
        ...style,
      }}
      className={cx(
        'z-[60] flex flex-col rounded-xl border border-line-strong bg-white p-1.5 shadow-[0_14px_30px_-18px_rgba(20,33,61,.45)]',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
});

export interface MenuOptionProps {
  id: string;
  active: boolean;
  selected: boolean;
  disabled?: boolean;
  multi?: boolean;
  onPick: () => void;
  onHover: () => void;
  children: ReactNode;
}

export function MenuOption({ id, active, selected, disabled, multi, onPick, onHover, children }: MenuOptionProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-active={active}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={disabled ? undefined : onHover}
      onClick={disabled ? undefined : onPick}
      className={cx(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
        disabled ? 'cursor-not-allowed text-ink-muted' : 'cursor-pointer text-ink',
        active && 'bg-brand/10',
        selected && 'font-semibold',
      )}
    >
      {multi && (
        <span
          aria-hidden="true"
          className={cx(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border',
            selected ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-white',
          )}
        >
          {selected && <Icon name="check" size={12} strokeWidth={3} />}
        </span>
      )}
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{children}</span>
      {selected && !multi && <Icon name="check" size={16} className="shrink-0 text-brand" />}
    </div>
  );
}

export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p
        aria-hidden="true"
        className="mx-2.5 mb-1 mt-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-ink-muted"
      >
        {label}
      </p>
      {children}
    </div>
  );
}

export function MenuEmpty({ children }: { children: ReactNode }) {
  return <p className="px-2.5 py-3 text-sm text-ink-muted">{children}</p>;
}

export interface MenuSearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'className'> {
  label: string;
  listId: string;
  activeId?: string;
}

export const MenuSearch = forwardRef<HTMLInputElement, MenuSearchProps>(function MenuSearch(
  { label, listId, activeId, ...rest },
  ref,
) {
  return (
    <div className="relative mb-1">
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        ref={ref}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={label}
        placeholder={label}
        {...rest}
        className={cx(
          'h-9 w-full rounded-lg border border-line-strong bg-white pl-8 pr-2.5 text-sm text-ink placeholder:text-ink-muted',
          fieldFocusClass,
        )}
      />
    </div>
  );
});
