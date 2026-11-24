// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export type AuthErrorKind = 'credentials' | 'tooMany' | 'network' | 'cancelled' | 'generic';

export function authErrorKind(err: unknown): AuthErrorKind {
  const code = (err as { code?: unknown } | null)?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
    case 'auth/user-disabled':
      return 'credentials';
    case 'auth/too-many-requests':
      return 'tooMany';
    case 'auth/network-request-failed':
      return 'network';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'cancelled';
    default:
      return 'generic';
  }
}

export function authErrorMessage(err: unknown, t: (key: string) => string): string | null {
  switch (authErrorKind(err)) {
    case 'cancelled':
      return null;
    case 'credentials':
      return t('errors.credentials');
    case 'tooMany':
      return t('errors.tooMany');
    case 'network':
      return t('errors.network');
    default:
      return t('errors.generic');
  }
}

export function detailCode(err: unknown): string | null {
  const code = (err as { details?: { code?: unknown } } | null)?.details?.code;
  return typeof code === 'string' ? code : null;
}
