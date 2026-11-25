// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export interface SimilarCandidate { id: string; name: string }
export interface SimilarMatch extends SimilarCandidate { score: number }

const STOP = new Set(['vidyalaya', 'vidyalayam', 'v', 'mv', 'mmv', 'bmv', 'college', 'school', 'national', 'maha', 'primary', 'kanishta', 'navodya']);
const THRESHOLD = 0.5;

function tokens(name: string): string[] {
  const all = name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter((t) => t.length > 1);
  const kept = all.filter((t) => !STOP.has(t));
  return kept.length ? kept : all;
}

function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

function score(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  const left = new Set(sb);
  let inter = 0;
  for (const t of sa) {
    const hit = left.has(t) ? t : [...left].find((u) => Math.min(t.length, u.length) >= 5 && distance(t, u) <= 1);
    if (hit !== undefined) {
      inter++;
      left.delete(hit);
    }
  }
  const jaccard = inter / (sa.size + sb.size - inter);
  const ja = a.join(' ');
  const jb = b.join(' ');
  const edit = 1 - distance(ja, jb) / Math.max(ja.length, jb.length);
  const containment = inter / Math.min(sa.size, sb.size);
  return Math.min(1, jaccard * 0.55 + containment * 0.4 + edit * 0.05);
}

export function similarSchools(name: string, candidates: SimilarCandidate[], limit = 5): SimilarMatch[] {
  const q = tokens(name);
  return candidates
    .map((c) => ({ ...c, score: score(q, tokens(c.name)) }))
    .filter((m) => m.score >= THRESHOLD)
    .sort((x, y) => y.score - x.score || x.name.localeCompare(y.name))
    .slice(0, limit);
}
