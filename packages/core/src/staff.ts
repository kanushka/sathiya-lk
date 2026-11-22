// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export function formatStaffId(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(3, '0')}`;
}

export function isValidStaffId(prefix: string, id: string): boolean {
  return /^[A-Z]{2,5}$/.test(prefix) && id.startsWith(prefix) && /^\d{3}$/.test(id.slice(prefix.length));
}

export function syntheticEmail(staffId: string, schoolId: string): string {
  return `${staffId.toLowerCase()}@${schoolId}.teachers.sathiya.lk`;
}

export function nextStaffNumber(existing: string[], prefix: string): number {
  let max = 0;
  for (const id of existing) {
    if (isValidStaffId(prefix, id)) max = Math.max(max, Number(id.slice(prefix.length)));
  }
  return max + 1;
}

const isInitial = (w: string) => /^[A-Za-z]$/.test(w) || /^([A-Za-z]\.)+[A-Za-z]?$/.test(w);

export function suggestStaffPrefix(name: string): string {
  const words = name
    .trim()
    .replace(/^[A-Za-z]{1,4}\s*\/\s*/, '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !isInitial(w));
  if (words.length === 0) return '';
  const prefix =
    words.length === 1
      ? words[0]!.replace(/[^A-Za-z]/g, '').slice(0, 3)
      : words
          .slice(0, 4)
          .map((w) => w[0])
          .join('');
  return prefix.length >= 2 ? prefix.toUpperCase() : '';
}
