// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type SetJoinLinkRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { invalid, obj, requireSchoolAdmin } from './lib/guards';
import { hashToken, newToken } from './lib/tokens';

export const setJoinLink = onCall(callOpts, async (req): Promise<SetJoinLinkRes> => {
  const data = obj(req.data, 'request');
  const { sid, uid } = await requireSchoolAdmin(req, data.schoolId);
  const ref = db.doc(paths.joinLink(sid));
  if (data.action === 'off') {
    await ref.delete();
    return {};
  }
  if (data.action !== 'create') invalid('action must be create or off');
  const token = newToken();
  await ref.set({ hash: hashToken(token), createdAt: Date.now(), createdBy: uid });
  return { token };
});
