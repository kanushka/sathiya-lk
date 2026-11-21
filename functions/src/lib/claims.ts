import type { Claims } from '@sathiya/core';
import { auth } from './admin';

export async function setSchoolClaims(uid: string, claims: { sid: string; role: 'admin' | 'teacher'; tid?: string }): Promise<void> {
  const user = await auth.getUser(uid);
  const next: Claims = { sid: claims.sid, role: claims.role };
  if (claims.tid) next.tid = claims.tid;
  if (user.customClaims?.super === true) next.super = true;
  await auth.setCustomUserClaims(uid, next);
}
