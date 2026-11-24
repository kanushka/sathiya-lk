// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { detailCode } from '../auth/errors';

export type RegisterFailureCode = 'school-registered' | 'email-unverified' | 'too-many-schools' | 'rate-limited';
export interface RegisterFailure {
  code: RegisterFailureCode;
  schoolId?: string;
}

const codes: readonly string[] = ['school-registered', 'email-unverified', 'too-many-schools', 'rate-limited'];

export function registerFailure(err: unknown): RegisterFailure | null {
  const code = detailCode(err);
  if (!code || !codes.includes(code)) return null;
  const schoolId = (err as { details?: { schoolId?: unknown } }).details?.schoolId;
  return { code: code as RegisterFailureCode, ...(typeof schoolId === 'string' && schoolId ? { schoolId } : {}) };
}

export function isUnverifiedPasswordUser(user: { emailVerified?: boolean; providerData?: { providerId: string }[] } | null): boolean {
  return !!user && !user.emailVerified && !!user.providerData?.some((p) => p.providerId === 'password');
}
