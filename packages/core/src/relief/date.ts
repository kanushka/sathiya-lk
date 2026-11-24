// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex } from '../types';

const DAY_MS = 86_400_000;
const COLOMBO_OFFSET_MS = 330 * 60_000;

export function colomboToday(instant: Date): { date: string; day: DayIndex | null } {
  const shifted = new Date(instant.getTime() + COLOMBO_OFFSET_MS);
  const weekday = shifted.getUTCDay();
  const date = new Date(Math.floor(shifted.getTime() / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
  return { date, day: weekday === 0 || weekday === 6 ? null : ((weekday - 1) as DayIndex) };
}
