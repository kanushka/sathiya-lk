// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, PinSpec } from '@sathiya/core';
import { useEffect, useRef, type MutableRefObject } from 'react';

export type PinOrigin = { day: DayIndex; period: number } | { key: string } | null;

export function usePinExit(target: PinSpec | null, stop: () => void): MutableRefObject<PinOrigin> {
  const origin = useRef<PinOrigin>(null);
  const wasOn = useRef(false);

  useEffect(() => {
    if (target) {
      wasOn.current = true;
      return;
    }
    if (!wasOn.current) return;
    wasOn.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const o = origin.current;
    const el =
      o && 'key' in o
        ? document.querySelector<HTMLElement>(`[data-pin-key="${o.key}"]`)
        : o && document.querySelector<HTMLElement>(`[data-day="${o.day}"][data-period="${o.period}"]`);
    el?.focus();
  }, [target]);

  useEffect(() => {
    if (!target) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('[role="dialog"]')) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
      stop();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [target, stop]);

  return origin;
}
