// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { type LinkSelfRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { callOpts } from './lib/callOptions';
import { syncClaims } from './lib/claims';
import { docId, obj, requireSchoolAdmin } from './lib/guards';
import { linkTeacher } from './lib/linkTeacher';
import { runTx } from './lib/tx';

export const linkSelf = onCall(callOpts, async (req): Promise<LinkSelfRes> => {
  const data = obj(req.data, 'request');
  const { sid, uid, token } = await requireSchoolAdmin(req, data.schoolId);
  const teacherId = docId(data.teacherId, 'teacherId');
  const email = token.email?.toLowerCase();
  await runTx((tx) => linkTeacher(tx, sid, teacherId, uid, { role: 'admin', ...(email && { email }) }));
  await syncClaims(uid);
  return { ok: true };
});
