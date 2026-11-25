// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { detailCode } from '../auth/errors';

export type RegisterFailureCode = 'school-registered' | 'email-unverified' | 'too-many-schools' | 'rate-limited' | 'terms-outdated';
export interface RegisterFailure {
  code: RegisterFailureCode;
  schoolId?: string;
}

const codes: readonly string[] = ['school-registered', 'email-unverified', 'too-many-schools', 'rate-limited', 'terms-outdated'];

export function registerFailure(err: unknown): RegisterFailure | null {
  const code = detailCode(err);
  if (!code || !codes.includes(code)) return null;
  const schoolId = (err as { details?: { schoolId?: unknown } }).details?.schoolId;
  return { code: code as RegisterFailureCode, ...(typeof schoolId === 'string' && schoolId ? { schoolId } : {}) };
}

export function isUnverifiedPasswordUser(user: { emailVerified?: boolean; providerData?: { providerId: string }[] } | null): boolean {
  return !!user && !user.emailVerified && !!user.providerData?.some((p) => p.providerId === 'password');
}

export type AccountErrorKey = 'emailInUse' | 'weakPassword' | 'invalidEmail';

export function accountCreateError(err: unknown): { field: 'email' | 'password'; key: AccountErrorKey } | null {
  switch ((err as { code?: unknown } | null)?.code) {
    case 'auth/email-already-in-use':
      return { field: 'email', key: 'emailInUse' };
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return { field: 'password', key: 'weakPassword' };
    case 'auth/invalid-email':
      return { field: 'email', key: 'invalidEmail' };
    default:
      return null;
  }
}
