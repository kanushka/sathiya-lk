// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { KeyboardEvent } from 'react';

export interface ListOption {
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface OptionGroup<O> {
  name: string;
  options: O[];
}

export function groupOptions<O extends ListOption>(options: O[]): OptionGroup<O>[] {
  const byName = new Map<string, O[]>();
  for (const o of options) {
    const g = o.group ?? '';
    const list = byName.get(g);
    if (list) list.push(o);
    else byName.set(g, [o]);
  }
  return [...byName].map(([name, list]) => ({ name, options: list }));
}

export function filterOptions<O extends ListOption>(options: O[], query: string): O[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
}

export function firstEnabled(list: { disabled?: boolean }[], from: number, step: 1 | -1): number {
  for (let i = from; i >= 0 && i < list.length; i += step) {
    if (!list[i]!.disabled) return i;
  }
  return -1;
}

export function navigateIndex(key: string, list: { disabled?: boolean }[], current: number): number | null {
  let next: number;
  switch (key) {
    case 'ArrowDown':
      next = firstEnabled(list, current < 0 ? 0 : current + 1, 1);
      break;
    case 'ArrowUp':
      next = firstEnabled(list, current < 0 ? list.length - 1 : current - 1, -1);
      break;
    case 'Home':
      next = firstEnabled(list, 0, 1);
      break;
    case 'End':
      next = firstEnabled(list, list.length - 1, -1);
      break;
    default:
      return null;
  }
  return next < 0 ? current : next;
}

export function isPrintable(e: KeyboardEvent): boolean {
  return e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
}
