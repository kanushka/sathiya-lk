// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export interface DirectorySchool {
  id: string;
  nameEn: string;
  nameSi?: string;
  district: string;
  city?: string;
  status: 'active' | 'disabled';
}

export function mergeDirectoryResults(
  byName: DirectorySchool[],
  byCity: DirectorySchool[],
  max = 10,
): DirectorySchool[] {
  const seen = new Set<string>();
  const out: DirectorySchool[] = [];
  for (const s of [...byName, ...byCity]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out.slice(0, max);
}
