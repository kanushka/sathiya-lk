// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ReactNode } from 'react';
import { focusRingClass } from './Button';
import { cx } from './cx';
import { rovingKeyDown } from './roving';

export interface TabItem<V extends string = string> {
  value: V;
  label: ReactNode;
}

export interface TabsProps<V extends string = string> {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  'aria-label': string;
  variant?: 'underline' | 'segmented';
  idBase?: string;
  className?: string;
}

export const tabId = (idBase: string, value: string) => `${idBase}-tab-${value}`;
export const tabPanelId = (idBase: string, value: string) => `${idBase}-panel-${value}`;

export function Tabs<V extends string = string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
  variant = 'underline',
  idBase,
  className,
}: TabsProps<V>) {
  const segmented = variant === 'segmented';
  const values = items.map((i) => i.value);
  const hasSelection = values.includes(value);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={(e) => rovingKeyDown({ event: e, values, current: value, select: onChange, itemRole: 'tab' })}
      className={cx(
        segmented ? 'flex gap-1 rounded-[10px] bg-surface-3 p-1' : 'flex gap-1 border-b border-line',
        className,
      )}
    >
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            id={idBase ? tabId(idBase, item.value) : undefined}
            aria-controls={idBase ? tabPanelId(idBase, item.value) : undefined}
            tabIndex={selected || (!hasSelection && i === 0) ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cx(
              'font-semibold transition-colors',
              focusRingClass,
              segmented
                ? cx(
                    'h-10 flex-1 rounded-lg px-3 text-[15px]',
                    selected
                      ? 'bg-white text-ink shadow-[0_1px_3px_rgba(20,33,61,.15)]'
                      : 'text-ink-muted hover:text-ink',
                  )
                : cx(
                    'relative -mb-px h-10 rounded-t-lg px-3 text-sm',
                    selected
                      ? 'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand'
                      : 'text-ink-muted hover:text-ink',
                  ),
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
