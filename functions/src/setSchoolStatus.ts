// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type SetSchoolStatusRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { fail, invalid, obj, requireSuper, str } from './lib/guards';

export const setSchoolStatus = onCall(callOpts, async (req): Promise<SetSchoolStatusRes> => {
  requireSuper(req);
  const data = obj(req.data, 'request');
  const sid = str(data.schoolId, 'schoolId');
  const status = data.status;
  if (status !== 'active' && status !== 'disabled') invalid('status must be active or disabled');
  const schoolRef = db.doc(paths.school(sid));
  await db.runTransaction(async (tx) => {
    if (!(await tx.get(schoolRef)).exists) fail('not-found', 'invalid', 'School not found');
    tx.update(schoolRef, { status });
    tx.set(db.doc(paths.directory(sid)), { status }, { merge: true });
  });
  return { ok: true };
});
