// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export type ActionErrorKey = 'expired' | 'invalid' | 'weak' | 'network' | 'generic';

export function actionErrorKey(err: unknown): ActionErrorKey {
  switch ((err as { code?: unknown } | null)?.code) {
    case 'auth/expired-action-code':
      return 'expired';
    case 'auth/invalid-action-code':
      return 'invalid';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'weak';
    case 'auth/network-request-failed':
      return 'network';
    default:
      return 'generic';
  }
}
