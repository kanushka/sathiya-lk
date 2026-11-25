// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Member, type RemoveAdminRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { syncClaimsAndRevoke } from './lib/claims';
import { docId, fail, obj, requireSchoolAdmin } from './lib/guards';
import { runTx } from './lib/tx';

const notAdmin = (): never => fail('failed-precondition', 'invalid', 'This member is not an admin');
const lastAdmin = (): never => fail('failed-precondition', 'last-admin', 'A school needs at least one admin');

export const removeAdmin = onCall(callOpts, async (req): Promise<RemoveAdminRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const target = docId(data.uid, 'uid');
  const memberRef = db.doc(`${paths.members(sid)}/${target}`);
  const admins = db.collection(paths.members(sid)).where('role', '==', 'admin');
  const [before, count] = await Promise.all([memberRef.get(), admins.count().get()]);
  if ((before.data() as Member | undefined)?.role !== 'admin') notAdmin();
  if (count.data().count <= 1) lastAdmin();
  // Revoke first: if the commit or claim sync then fails, the account must sign in again, where claimInvites repairs its claims.
  await auth.revokeRefreshTokens(target);
  const email = (await auth.getUser(target)).email?.toLowerCase();
  const role = await runTx(async (tx) => {
    // Reading every admin in the transaction makes two admins removing each other conflict instead of both succeeding.
    const [member, all] = await Promise.all([tx.get(memberRef), tx.get(admins)]);
    const m = member.data() as Member | undefined;
    if (m?.role !== 'admin') notAdmin();
    if (all.size <= 1) lastAdmin();
    // A pending invite for the same address would hand the role straight back at the next sign-in.
    if (email) tx.delete(db.doc(`${paths.invites(sid)}/${email}`));
    if (m!.teacherId) {
      tx.update(memberRef, { role: 'teacher' });
      return 'teacher' as const;
    }
    tx.delete(memberRef);
    return null;
  });
  await syncClaimsAndRevoke([target]);
  return { role };
});
