// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Colombo',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

export function colomboNow(instant: Date): Date {
  const v: Record<string, number> = {};
  for (const p of fmt.formatToParts(instant)) if (p.type !== 'literal') v[p.type] = Number(p.value);
  return new Date(v.year as number, (v.month as number) - 1, v.day as number, v.hour as number, v.minute as number, v.second as number);
}

export function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  return hour < 17 ? 'afternoon' : 'evening';
}
