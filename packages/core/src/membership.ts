// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Claims, Membership } from './types';

export const MAX_SCHOOLS = 20;

export function membershipOf(c: Claims, sid: string): Membership | undefined {
  return c.schools?.[sid];
}

export function isSchoolAdmin(c: Claims, sid: string): boolean {
  return membershipOf(c, sid)?.r === 'a';
}

export function teacherIdOf(c: Claims, sid: string): string | undefined {
  return membershipOf(c, sid)?.t;
}

export function schoolIds(c: Claims): string[] {
  return Object.keys(c.schools ?? {});
}
