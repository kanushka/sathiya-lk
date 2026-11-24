// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type DecideJoinRequestRes, type JoinRequest } from '@sathiya/core';
import type { Transaction } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { assertSchoolRoom, syncClaims } from './lib/claims';
import { bool, docId, fail, obj, requireSchoolAdmin } from './lib/guards';
import { linkTeacher } from './lib/linkTeacher';
import { runTx } from './lib/tx';

export const decideJoinRequest = onCall(callOpts, async (req): Promise<DecideJoinRequestRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const target = docId(data.uid, 'uid');
  const teacherId = docId(data.teacherId, 'teacherId');
  const approve = bool(data.approve, 'approve');
  const ref = db.doc(`${paths.joinRequests(sid)}/${target}`);

  // The decision applies only to the request the admin reviewed: same teacher, still pending.
  const pending = async (tx: Transaction): Promise<JoinRequest> => {
    const request = (await tx.get(ref)).data() as JoinRequest | undefined;
    if (!request) fail('not-found', 'invalid', 'Request not found');
    if (request!.status && request!.status !== 'pending') fail('failed-precondition', 'invalid', 'This request was already decided');
    if (request!.teacherId !== teacherId) fail('failed-precondition', 'invalid', 'This request changed since it was reviewed');
    return request!;
  };

  if (!approve) {
    await runTx(async (tx) => {
      await pending(tx);
      tx.update(ref, { status: 'rejected', decidedAt: Date.now() });
    });
    return { ok: true };
  }
  await assertSchoolRoom(target, sid);
  await runTx(async (tx) => {
    const { email, name } = await pending(tx);
    await linkTeacher(tx, sid, teacherId, target, { email, ...(name && { name }) });
  });
  await syncClaims(target);
  return { ok: true };
});
