// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useRef } from 'react';

export interface TypeaheadItem {
  label: string;
  disabled?: boolean;
}

const RESET_MS = 500;

export function useTypeahead(items: TypeaheadItem[], onMatch: (index: number) => void) {
  const buffer = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  return function type(key: string, current: number): boolean {
    if (key.length !== 1 || (key === ' ' && buffer.current === '')) return false;
    clearTimeout(timer.current);
    buffer.current += key.toLowerCase();
    timer.current = setTimeout(() => {
      buffer.current = '';
    }, RESET_MS);
    const query = buffer.current;
    const n = items.length;
    // A longer query may still match the current option, so it is checked first.
    const start = query.length > 1 ? current : current + 1;
    for (let step = 0; step < n; step += 1) {
      const i = (((start + step) % n) + n) % n;
      const item = items[i]!;
      if (!item.disabled && item.label.toLowerCase().startsWith(query)) {
        onMatch(i);
        return true;
      }
    }
    return true;
  };
}
