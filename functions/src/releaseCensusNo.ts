// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type ReleaseCensusNoRes } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, fail, obj, requireSuper } from './lib/guards';
import { runTx } from './lib/tx';

export const releaseCensusNo = onCall(callOpts, async (req): Promise<ReleaseCensusNoRes> => {
  const { uid } = requireSuper(req);
  const sid = docId(obj(req.data, 'request').schoolId, 'schoolId');
  const schoolRef = db.doc(paths.school(sid));
  return runTx(async (tx) => {
    const school = await tx.get(schoolRef);
    if (!school.exists) fail('not-found', 'invalid', 'School not found');
    const censusNo = school.get('censusNo') as string | undefined;
    if (!censusNo) fail('failed-precondition', 'invalid', 'School has no census number');
    const indexRef = db.doc(paths.censusIndex(censusNo!));
    const index = await tx.get(indexRef);
    const freed = index.exists && index.get('schoolId') === sid;
    if (freed) tx.delete(indexRef);
    tx.update(schoolRef, { censusNo: FieldValue.delete(), releasedCensusNo: censusNo, censusReleasedAt: Date.now(), censusReleasedBy: uid });
    return { censusNo: censusNo!, freed };
  });
});
