// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from 'react';
import { placePopover, type Placement } from '../popoverPlacement';

const LIST_MAX = 288;

export function usePopover(
  triggerRef: RefObject<HTMLElement | null>,
  popRef: RefObject<HTMLElement | null>,
  open: boolean,
  deps: DependencyList,
  onOutsideMouseDown?: () => void,
): { pos: Placement | null; listMax: number } {
  const [state, setState] = useState<{ pos: Placement; listMax: number } | null>(null);
  const onOutsideRef = useRef(onOutsideMouseDown);
  onOutsideRef.current = onOutsideMouseDown;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popRef.current?.contains(target)) return;
      onOutsideRef.current?.();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, triggerRef, popRef]);

  useLayoutEffect(() => {
    if (!open) {
      setState(null);
      return;
    }
    function reposition() {
      const trigger = triggerRef.current;
      const pop = popRef.current;
      if (!trigger || !pop) return;
      const r = trigger.getBoundingClientRect();
      const list = pop.querySelector<HTMLElement>('[role="listbox"]');
      const chrome = pop.offsetHeight - (list?.offsetHeight ?? 0);
      const contentHeight = chrome + Math.min(list?.scrollHeight ?? 0, LIST_MAX);
      const pos = placePopover({
        anchor: { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
        contentHeight,
        viewportHeight: window.innerHeight,
      });
      setState({ pos, listMax: Math.max(0, Math.min(LIST_MAX, pos.maxHeight - chrome)) });
    }
    reposition();
    function onScroll(e: Event) {
      if (e.target instanceof Node && popRef.current?.contains(e.target)) return;
      reposition();
    }
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, ...deps]);

  return { pos: state?.pos ?? null, listMax: state?.listMax ?? LIST_MAX };
}
