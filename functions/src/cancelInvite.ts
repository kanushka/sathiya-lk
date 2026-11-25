// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type CancelInviteRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { email, obj, requireSchoolAdmin } from './lib/guards';

export const cancelInvite = onCall(callOpts, async (req): Promise<CancelInviteRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  await db.doc(`${paths.invites(sid)}/${email(data.email)}`).delete();
  return { ok: true };
});
