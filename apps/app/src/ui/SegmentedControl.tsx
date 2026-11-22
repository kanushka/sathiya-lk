// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { cx } from './cx';
import { rovingKeyDown } from './roving';

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: ReactNode;
}

export interface SegmentedControlProps<V extends string = string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  'aria-label': string;
  size?: 'sm' | 'md';
  tone?: 'default' | 'onBrand';
  className?: string;
}

export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  size = 'md',
  tone = 'default',
  className,
}: SegmentedControlProps<V>) {
  const values = options.map((o) => o.value);
  const hasSelection = values.includes(value);
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(e) => rovingKeyDown({ event: e, values, current: value, select: onChange, itemRole: 'radio', vertical: true })}
      className={cx(
        'inline-flex gap-0.5 rounded-[10px] p-[3px]',
        tone === 'onBrand' ? 'bg-black/15' : 'bg-surface-3',
        className,
      )}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (!hasSelection && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-[7px] px-3.5 text-[13px] font-semibold transition-colors',
              size === 'sm' ? 'h-7' : 'h-8',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
              tone === 'onBrand' ? 'focus-visible:ring-white' : 'focus-visible:ring-brand',
              checked
                ? 'bg-white text-ink shadow-[0_1px_3px_rgba(20,33,61,.18)]'
                : tone === 'onBrand'
                  ? 'text-on-brand'
                  : 'text-ink-soft',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
