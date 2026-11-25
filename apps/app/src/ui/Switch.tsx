// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { focusRingClass } from './Button';
import { cx } from './cx';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled, id, className }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'inline-flex items-center gap-2.5 rounded-lg text-left text-sm',
        focusRingClass,
        'disabled:cursor-not-allowed disabled:opacity-[.45]',
        'text-ink',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          className={cx(
            'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </span>
      {label}
    </button>
  );
}
