// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ADMIN_INVITE_TTL_MS, paths, type ClaimInvitesRes, type Member, type School } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import type { DocumentReference } from 'firebase-admin/firestore';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { hasSchoolRoom, syncClaims } from './lib/claims';
import { linkTeacher } from './lib/linkTeacher';
import { runTx } from './lib/tx';
import { isVerified, notAllowed, requireAuth } from './lib/guards';

const INVITES = paths.invites('_').split('/').pop()!;

interface Invite {
  email: string;
  teacherId?: string;
  createdAt?: number;
}

// A teacher that is already linked, or gone, still lets the invitee become admin, just without the teacher link.
async function tryLink(sid: string, teacherId: string, uid: string, email: string, name: string): Promise<boolean> {
  const teacher = await db.doc(`${paths.teachers(sid)}/${teacherId}`).get();
  if (teacher.get('uid') === uid) return false;
  try {
    await runTx((tx) => linkTeacher(tx, sid, teacherId, uid, { role: 'admin', email, ...(name && { name }) }));
    return true;
  } catch (e) {
    const err = e as { code?: string; details?: { code?: string } };
    if (err.details?.code === 'already-linked' || err.code === 'not-found') return false;
    throw e;
  }
}

export const claimInvites = onCall(callOpts, async (req): Promise<ClaimInvitesRes> => {
  const { uid, token } = requireAuth(req);
  if (!token.email || !isVerified(token)) notAllowed('A verified email is required');
  const email = token.email!.toLowerCase();
  const name = typeof token.name === 'string' ? token.name.trim() : '';

  // Members are written before claims are synced, and invites are consumed only after, so a failure leaves them for a retry.
  const invites = await db.collectionGroup(INVITES).where('email', '==', email).get();
  const claimed: { sid: string; ref: DocumentReference }[] = [];
  const expired: DocumentReference[] = [];
  const cutoff = Date.now() - ADMIN_INVITE_TTL_MS;
  for (const doc of invites.docs) {
    const createdAt = (doc.data() as Invite).createdAt;
    if (typeof createdAt !== 'number' || createdAt < cutoff) {
      expired.push(doc.ref);
      continue;
    }
    const sid = doc.ref.parent.parent!.id;
    const memberRef = db.doc(`${paths.members(sid)}/${uid}`);
    const [school, member] = await Promise.all([db.doc(paths.school(sid)).get(), memberRef.get()]);
    if ((school.data() as School | undefined)?.status !== 'active') continue;
    if (!(await hasSchoolRoom(uid, sid))) continue;
    const existing = member.data() as Member | undefined;
    const teacherId = (doc.data() as Invite).teacherId;
    const linked = teacherId ? await tryLink(sid, teacherId, uid, email, name) : false;
    if (!linked) {
      await memberRef.set({ uid, role: 'admin', email, ...(name && !existing?.name ? { name } : {}) }, { merge: true });
    }
    claimed.push({ sid, ref: doc.ref });
  }
  // Runs on every sign-in, so it also repairs claims a failed sync elsewhere (e.g. registerSchool) left behind.
  await syncClaims(uid);
  await Promise.all([...claimed.map((c) => c.ref), ...expired].map((ref) => ref.delete()));
  return { schoolIds: claimed.map((c) => c.sid) };
});
