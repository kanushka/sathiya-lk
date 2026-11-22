// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { focusRingClass } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';

export interface ChipProps {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  removeTabIndex?: number;
  color?: string;
  disabled?: boolean;
  className?: string;
}

export function Chip({ children, onRemove, removeLabel, removeTabIndex, color, disabled, className }: ChipProps) {
  return (
    <span
      style={color ? { backgroundColor: color } : undefined}
      className={cx(
        'inline-flex h-[26px] items-center gap-0.5 rounded-md text-[13px] font-semibold',
        color ? '' : 'bg-brand/10',
        disabled ? 'text-ink-muted' : 'text-ink',
        onRemove ? 'pl-2 pr-0.5' : 'px-2',
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          tabIndex={removeTabIndex}
          aria-label={removeLabel}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cx(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-black/10 hover:text-ink',
            focusRingClass,
            'disabled:cursor-not-allowed disabled:hover:bg-transparent',
          )}
        >
          <Icon name="close" size={12} strokeWidth={2.4} />
        </button>
      )}
    </span>
  );
}

export interface ToggleChipProps {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function ToggleChip({ pressed, onToggle, children, disabled, className }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={cx(
        'h-8 rounded-lg border px-3 text-[13px] font-semibold transition-colors',
        focusRingClass,
        'disabled:cursor-not-allowed disabled:opacity-[.45]',
        pressed ? 'border-brand bg-brand/10 text-brand' : 'border-line-strong bg-white text-ink-soft hover:bg-surface',
        className,
      )}
    >
      {children}
    </button>
  );
}
