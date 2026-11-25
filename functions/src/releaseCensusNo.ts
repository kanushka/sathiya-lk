// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type ReleaseCensusNoRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { releaseCensus } from './lib/census';
import { docId, fail, obj, requireSuper } from './lib/guards';
import { runTx } from './lib/tx';

export const releaseCensusNo = onCall(callOpts, async (req): Promise<ReleaseCensusNoRes> => {
  const { uid } = requireSuper(req);
  const sid = docId(obj(req.data, 'request').schoolId, 'schoolId');
  const schoolRef = db.doc(paths.school(sid));
  return runTx(async (tx) => {
    const school = await tx.get(schoolRef);
    if (!school.exists) fail('not-found', 'invalid', 'School not found');
    const released = await releaseCensus(tx, school, uid);
    if (!released) fail('failed-precondition', 'invalid', 'School has no census number');
    return released!;
  });
});
