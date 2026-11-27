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

/** Calendar date `n` days after `date` (YYYY-MM-DD), in UTC so no time zone can shift it. */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Monday 0 … Friday 4, or null on a weekend. */
export function schoolDayOf(date: string): DayIndex | null {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 ? null : ((weekday - 1) as DayIndex);
}

/** The school day `n` school days after `date` (n may be negative). Weekends are skipped. */
export function addSchoolDays(date: string, n: number): { date: string; day: DayIndex } {
  const step = n < 0 ? -1 : 1;
  let at = date;
  let left = Math.abs(n);
  while (left > 0 || schoolDayOf(at) === null) {
    at = addDays(at, step);
    if (schoolDayOf(at) !== null) left = Math.max(0, left - 1);
  }
  return { date: at, day: schoolDayOf(at)! };
}

/** The first school day after today in Colombo: tomorrow, or Monday from Friday to Sunday. */
export function nextSchoolDay(instant: Date): { date: string; day: DayIndex } {
  return addSchoolDays(colomboToday(instant).date, 1);
}
