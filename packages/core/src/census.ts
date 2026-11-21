// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { SchoolType } from './types';

export const CENSUS_NO_LENGTH = { min: 4, max: 6 } as const;
export const CENSUS_NO_RE = new RegExp(`^\\d{${CENSUS_NO_LENGTH.min},${CENSUS_NO_LENGTH.max}}$`);

export function normalizeCensusNo(s: string): string | null {
  const cleaned = s.replace(/\s+/g, '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (!/^\d+$/.test(cleaned)) return null;
  return cleaned.length >= CENSUS_NO_LENGTH.min && cleaned.length <= CENSUS_NO_LENGTH.max ? cleaned : null;
}

export function censusRequired(type: SchoolType): boolean {
  return type === 'government';
}
