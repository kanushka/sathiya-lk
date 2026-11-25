// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Slot } from './slots';

function runCount(chosen: Slot[]): number {
  let runs = 0;
  chosen.forEach((s, i) => {
    if (i === 0 || chosen[i - 1]!.nextPeriod !== s.period) runs += 1;
  });
  return runs;
}

function comparePeriods(a: Slot[], b: Slot[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = a[i]!.period - b[i]!.period;
    if (d) return d;
  }
  return a.length - b.length;
}

const MAX_NODES = 20000;

export function combos(slots: Slot[], target: number, limit = 20): Slot[][] {
  if (target <= 0 || limit <= 0) return [];
  const sorted = [...slots].sort((a, b) => a.start - b.start || a.period - b.period);
  const suffix: number[] = new Array(sorted.length + 1).fill(0);
  for (let i = sorted.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1]! + sorted[i]!.minutes;

  const found: Slot[][] = [];
  const chosen: Slot[] = [];
  let nodes = 0;
  const walk = (i: number, sum: number) => {
    if (++nodes > MAX_NODES) return;
    if (sum === target) {
      found.push([...chosen]);
      return;
    }
    if (i >= sorted.length || sum + suffix[i]! < target) return;
    const s = sorted[i]!;
    if (sum + s.minutes <= target) {
      chosen.push(s);
      walk(i + 1, sum + s.minutes);
      chosen.pop();
    }
    walk(i + 1, sum);
  };
  walk(0, 0);

  return found
    .map((c) => ({ c, runs: runCount(c) }))
    .sort((a, b) => a.runs - b.runs || a.c.length - b.c.length || a.c[0]!.start - b.c[0]!.start || comparePeriods(a.c, b.c))
    .slice(0, limit)
    .map((x) => x.c);
}
