// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { isSchoolAdmin, schoolIds, teacherIdOf, type Claims } from '@sathiya/core';

export const LAST_SCHOOL_KEY = 'sathiya.lastSchool';

export function readLastSchool(): string | null {
  try {
    return localStorage.getItem(LAST_SCHOOL_KEY);
  } catch {
    return null;
  }
}

export function rememberLastSchool(sid: string): void {
  try {
    localStorage.setItem(LAST_SCHOOL_KEY, sid);
  } catch {
    return;
  }
}

export function schoolHomePath(claims: Claims, sid: string): string | null {
  if (isSchoolAdmin(claims, sid)) return `/s/${sid}/admin`;
  if (teacherIdOf(claims, sid)) return `/s/${sid}/me`;
  return null;
}

export function homePath(claims: Claims, last: string | null): string {
  const ids = schoolIds(claims);
  const ordered = last && ids.includes(last) ? [last, ...ids.filter((id) => id !== last)] : ids;
  for (const sid of ordered) {
    const path = schoolHomePath(claims, sid);
    if (path) return path;
  }
  return claims.super ? '/super' : '/start';
}
