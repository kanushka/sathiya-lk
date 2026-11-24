// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type DecideJoinRequestRes, type JoinRequest } from '@sathiya/core';
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
  const approve = bool(data.approve, 'approve');
  const ref = db.doc(`${paths.joinRequests(sid)}/${target}`);
  const request = (await ref.get()).data() as JoinRequest | undefined;
  if (!request) fail('not-found', 'invalid', 'Request not found');
  if (!approve) {
    await ref.update({ status: 'rejected', decidedAt: Date.now() });
    return { ok: true };
  }
  const { teacherId, email, name } = request!;
  await assertSchoolRoom(target, sid);
  await runTx((tx) => linkTeacher(tx, sid, teacherId, target, { email, ...(name && { name }) }));
  await syncClaims(target);
  return { ok: true };
});
