// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type ClaimInvitesRes, type Member, type School } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import type { DocumentReference } from 'firebase-admin/firestore';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { assertSchoolRoom, syncClaims } from './lib/claims';
import { isVerified, notAllowed, requireAuth } from './lib/guards';

const INVITES = paths.invites('_').split('/').pop()!;

interface Invite {
  email: string;
  teacherId?: string;
}

export const claimInvites = onCall(callOpts, async (req): Promise<ClaimInvitesRes> => {
  const { uid, token } = requireAuth(req);
  if (!token.email || !isVerified(token)) notAllowed('A verified email is required');
  const email = token.email!.toLowerCase();
  const name = typeof token.name === 'string' ? token.name.trim() : '';

  // Members are written before claims are synced, and invites are consumed only after, so a failure leaves them for a retry.
  const invites = await db.collectionGroup(INVITES).where('email', '==', email).get();
  const claimed: { sid: string; ref: DocumentReference }[] = [];
  for (const doc of invites.docs) {
    const sid = doc.ref.parent.parent!.id;
    const memberRef = db.doc(`${paths.members(sid)}/${uid}`);
    const [school, member] = await Promise.all([db.doc(paths.school(sid)).get(), memberRef.get()]);
    if ((school.data() as School | undefined)?.status !== 'active') continue;
    await assertSchoolRoom(uid, sid);
    const existing = member.data() as Member | undefined;
    const tid = (doc.data() as Invite).teacherId ?? existing?.teacherId;
    await memberRef.set({ uid, role: 'admin', email, teacherId: tid, ...(name && !existing?.name ? { name } : {}) }, { merge: true });
    claimed.push({ sid, ref: doc.ref });
  }
  if (claimed.length === 0) return { schoolIds: [] };
  await syncClaims(uid);
  await Promise.all(claimed.map((c) => c.ref.delete()));
  return { schoolIds: claimed.map((c) => c.sid) };
});
