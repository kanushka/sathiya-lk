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
