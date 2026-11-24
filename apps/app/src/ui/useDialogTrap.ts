// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useRef, type RefObject } from 'react';

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: symbol[] = [];

function inertOutside(keep: HTMLElement): () => void {
  const changed: Element[] = [];
  for (const el of Array.from(document.body.children)) {
    if (el === keep || el.contains(keep) || el.hasAttribute('inert') || el.matches('[aria-live], script')) continue;
    el.setAttribute('inert', '');
    changed.push(el);
  }
  return () => changed.forEach((el) => el.removeAttribute('inert'));
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(focusable)).filter((el) => !el.closest('[data-menu-panel]'));
}

export interface DialogTrapOptions {
  panelRef: RefObject<HTMLElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  focusPanel?: boolean;
  onClose: () => void;
}

export function useDialogTrap({ panelRef, containerRef, initialFocusRef, focusPanel = false, onClose }: DialogTrapOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = Symbol('dialog');
    stack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const restoreInert = containerRef.current ? inertOutside(containerRef.current) : undefined;
    const initial = initialFocusRef?.current;
    const first = focusPanel ? panel : ((initial && focusables(initial)[0]) ?? (panel && focusables(panel)[0]) ?? panel);
    first?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== id || !panel) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(panel);
      const head = items[0];
      const tail = items[items.length - 1];
      if (!head || !tail) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const active = document.activeElement;
      if (e.shiftKey && (active === head || !panel.contains(active))) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && (active === tail || !panel.contains(active))) {
        e.preventDefault();
        head.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreInert?.();
      stack.splice(stack.indexOf(id), 1);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
}
