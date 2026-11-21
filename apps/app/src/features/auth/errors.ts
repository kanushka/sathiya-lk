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
