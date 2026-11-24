// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { act } from '@testing-library/react';
import { vi } from 'vitest';

let width = 1280;
const listeners = new Set<() => void>();

export function installMatchMedia(initial: number): () => void {
  const original = window.matchMedia;
  width = initial;
  listeners.clear();
  window.matchMedia = vi.fn((query: string) => {
    const max = Number(/max-width:\s*([\d.]+)px/.exec(query)?.[1] ?? Infinity);
    return {
      get matches() {
        return width <= max;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    } as unknown as MediaQueryList;
  });
  return () => {
    window.matchMedia = original;
  };
}

export function resizeTo(next: number): void {
  width = next;
  act(() => listeners.forEach((fn) => fn()));
}
