// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type DeleteEntryRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, fail, obj, requireSchoolAdmin } from './lib/guards';
import { assertNotApplying } from './lib/yearBusy';

export const deleteEntry = onCall(callOpts, async (req): Promise<DeleteEntryRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const yid = docId(data.yearId, 'yearId');
  const ref = db.doc(`${paths.entries(sid, yid)}/${docId(data.entryId, 'entryId')}`);
  await db.runTransaction(async (tx) => {
    const year = await tx.get(db.doc(`${paths.years(sid)}/${yid}`));
    if (year.exists) assertNotApplying(year);
    if (!(await tx.get(ref)).exists) fail('not-found', 'invalid', 'Entry not found');
    tx.delete(ref);
  });
  return { ok: true };
});
