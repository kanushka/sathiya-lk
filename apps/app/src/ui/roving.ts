// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { KeyboardEvent } from 'react';

export interface RovingOptions<V extends string> {
  event: KeyboardEvent<HTMLElement>;
  values: V[];
  current: V;
  select: (v: V) => void;
  itemRole: string;
  vertical?: boolean;
}

export function rovingKeyDown<V extends string>({
  event: e,
  values,
  current,
  select,
  itemRole,
  vertical = false,
}: RovingOptions<V>) {
  if (values.length === 0) return;
  const prev = vertical ? ['ArrowLeft', 'ArrowUp'] : ['ArrowLeft'];
  const next = vertical ? ['ArrowRight', 'ArrowDown'] : ['ArrowRight'];
  const at = Math.max(0, values.indexOf(current));
  let to: number;
  if (prev.includes(e.key)) to = (at - 1 + values.length) % values.length;
  else if (next.includes(e.key)) to = (at + 1) % values.length;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = values.length - 1;
  else return;
  e.preventDefault();
  select(values[to] as V);
  e.currentTarget.querySelectorAll<HTMLElement>(`[role="${itemRole}"]`)[to]?.focus();
}
