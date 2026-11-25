// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ADMIN_INVITE_TTL_MS, paths, type ClaimInvitesRes, type School } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import type { DocumentReference, DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { hasSchoolRoom, syncClaims } from './lib/claims';
import { linkTeacher } from './lib/linkTeacher';
import { runTx } from './lib/tx';
import { isVerified, notAllowed, requireAuth } from './lib/guards';

const INVITES = paths.invites('_').split('/').pop()!;

const live = (invite: DocumentSnapshot, cutoff: number): boolean => {
  const createdAt = invite.get('createdAt') as unknown;
  return typeof createdAt === 'number' && createdAt >= cutoff;
};

// The invite is re-read in the granting transaction, so one cancelled or expired after the query grants nothing.
// A teacher that is already linked, or gone, still lets the invitee become admin, just without the teacher link.
async function grant(invite: DocumentSnapshot, cutoff: number, sid: string, uid: string, email: string, name: string): Promise<boolean> {
  const teacherId = invite.get('teacherId') as string | undefined;
  if (teacherId && (await db.doc(`${paths.teachers(sid)}/${teacherId}`).get()).get('uid') !== uid) {
    try {
      return await runTx(async (tx) => {
        if (!live(await tx.get(invite.ref), cutoff)) return false;
        await linkTeacher(tx, sid, teacherId, uid, { role: 'admin', email, ...(name && { name }) });
        return true;
      });
    } catch (e) {
      const err = e as { code?: string; details?: { code?: string } };
      if (err.details?.code !== 'already-linked' && err.code !== 'not-found') throw e;
    }
  }
  const memberRef = db.doc(`${paths.members(sid)}/${uid}`);
  return runTx(async (tx) => {
    const [inv, member] = await Promise.all([tx.get(invite.ref), tx.get(memberRef)]);
    if (!live(inv, cutoff)) return false;
    tx.set(memberRef, { uid, role: 'admin', email, ...(name && !member.get('name') ? { name } : {}) }, { merge: true });
    return true;
  });
}

export const claimInvites = onCall(callOpts, async (req): Promise<ClaimInvitesRes> => {
  const { uid, token } = requireAuth(req);
  if (!token.email || !isVerified(token)) notAllowed('A verified email is required');
  const email = token.email!.toLowerCase();
  const name = typeof token.name === 'string' ? token.name.trim() : '';

  // Members are written before claims are synced, and invites are consumed only after, so a failure leaves them for a retry.
  const invites = await db.collectionGroup(INVITES).where('email', '==', email).get();
  const claimed: { sid: string; ref: DocumentReference }[] = [];
  const expired: QueryDocumentSnapshot[] = [];
  const cutoff = Date.now() - ADMIN_INVITE_TTL_MS;
  for (const doc of invites.docs) {
    if (!live(doc, cutoff)) {
      expired.push(doc);
      continue;
    }
    const sid = doc.ref.parent.parent!.id;
    const school = await db.doc(paths.school(sid)).get();
    if ((school.data() as School | undefined)?.status !== 'active') continue;
    if (!(await hasSchoolRoom(uid, sid))) continue;
    if (await grant(doc, cutoff, sid, uid, email, name)) claimed.push({ sid, ref: doc.ref });
  }
  // Runs on every sign-in, so it also repairs claims a failed sync elsewhere (e.g. registerSchool) left behind.
  await syncClaims(uid);
  await Promise.all([
    ...claimed.map((c) => c.ref.delete()),
    // The precondition keeps an invite that was reissued under the same email after the query.
    ...expired.map((d) => d.ref.delete({ lastUpdateTime: d.updateTime }).catch(() => undefined)),
  ]);
  return { schoolIds: claimed.map((c) => c.sid) };
});
