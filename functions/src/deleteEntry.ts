// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type DeleteEntryRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { fail, obj, requireSchoolAdmin, str } from './lib/guards';

export const deleteEntry = onCall(callOpts, async (req): Promise<DeleteEntryRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const ref = db.doc(`${paths.entries(sid, str(data.yearId, 'yearId'))}/${str(data.entryId, 'entryId')}`);
  await db.runTransaction(async (tx) => {
    if (!(await tx.get(ref)).exists) fail('not-found', 'invalid', 'Entry not found');
    tx.delete(ref);
  });
  return { ok: true };
});
