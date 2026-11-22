// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useParams } from 'react-router-dom';

export function useAdminBase(): string {
  const { sid } = useParams();
  return sid ? `/s/${sid}` : '/admin';
}

export type ViewKind = 'class' | 'teacher';

const lastKey = (kind: ViewKind) => `sathiya.timetable.${kind}`;

export function rememberLast(kind: ViewKind, id: string): void {
  try {
    sessionStorage.setItem(lastKey(kind), id);
  } catch {
    return;
  }
}

export function readLast(kind: ViewKind): string | null {
  try {
    return sessionStorage.getItem(lastKey(kind));
  } catch {
    return null;
  }
}

// URL param first, then the last one viewed this session, then the first in the list.
export function pickInitial<T extends { id: string }>(kind: ViewKind, items: T[], params: URLSearchParams, aliases: string[]): T | undefined {
  const wanted = [...aliases.map((a) => params.get(a)), readLast(kind)];
  for (const id of wanted) {
    const hit = id ? items.find((x) => x.id === id) : undefined;
    if (hit) return hit;
  }
  return items[0];
}
