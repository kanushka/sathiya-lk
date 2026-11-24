// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Lang } from './types';

export type AmountUnit = 'periods' | 'minutes';

const siHours = (n: number): string => `${Math.floor(n / 60)}.${String(n % 60).padStart(2, '0')}`;

function enMinutes(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${n} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatAmount(n: number, unit: AmountUnit, lang: Lang): string {
  if (unit === 'periods') return String(n);
  if (lang === 'si') return n >= 60 ? `පැ. ${siHours(n)}` : `මි. ${n}`;
  return enMinutes(n);
}

export function formatAmountPair(placed: number, needed: number, unit: AmountUnit, lang: Lang): string {
  if (unit === 'periods') return `${placed}/${needed}`;
  const short = placed < 60 && needed < 60;
  if (lang === 'si') return short ? `මි. ${placed}/${needed}` : `පැ. ${siHours(placed)}/${siHours(needed)}`;
  return short ? `${placed}/${needed} min` : `${enMinutes(placed)}/${enMinutes(needed)}`;
}
