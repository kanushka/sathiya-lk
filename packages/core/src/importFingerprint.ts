// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Subject } from './types';

const fnv1a = (s: string, seed: number): string => {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

// Two differently seeded 32-bit passes; a lone 32-bit hash is too collision-prone for a doc id.
const hash = (s: string) => fnv1a(s, 0x811c9dc5) + fnv1a(s, 0x050c5d1f);

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function subjectsFingerprint(subjects: Pick<Subject, 'id' | 'nameEn' | 'nameSi' | 'short'>[]): string {
  const rows = [...subjects].sort((a, b) => cmp(a.id, b.id)).map((s) => [s.id, s.nameEn, s.nameSi ?? null, s.short]);
  return hash(JSON.stringify(rows));
}
