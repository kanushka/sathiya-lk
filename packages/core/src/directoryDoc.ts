// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export interface DirectoryDoc {
  nameEn: string;
  nameSi?: string;
  district: string;
  city: string;
  type?: string;
  status: string;
  nameLower: string;
  cityLower: string;
}

const lower = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

export function directoryFields(school: Record<string, unknown>): DirectoryDoc {
  const nameEn = school.nameEn as string;
  const city = school.city as string;
  return {
    nameEn,
    nameSi: school.nameSi as string | undefined,
    district: school.district as string,
    city,
    type: school.type as string | undefined,
    status: (school.status as string | undefined) ?? 'active',
    nameLower: lower(nameEn),
    cityLower: lower(city),
  };
}

const KEYS: (keyof DirectoryDoc)[] = ['nameEn', 'nameSi', 'district', 'city', 'type', 'status', 'nameLower', 'cityLower'];

export function sameDirectory(want: DirectoryDoc, have: Record<string, unknown> | undefined): boolean {
  if (!have) return false;
  return KEYS.every((k) => want[k] === have[k]) && Object.keys(have).every((k) => (KEYS as string[]).includes(k));
}
