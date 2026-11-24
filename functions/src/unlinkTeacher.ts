// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Member, type Teacher, type UnlinkTeacherRes } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { syncClaims } from './lib/claims';
import { docId, fail, obj, requireSchoolAdmin } from './lib/guards';
import { runTx } from './lib/tx';

export const unlinkTeacher = onCall(callOpts, async (req): Promise<UnlinkTeacherRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const teacherId = docId(data.teacherId, 'teacherId');
  const teacherRef = db.doc(`${paths.teachers(sid)}/${teacherId}`);
  const uid = await runTx(async (tx) => {
    const teacher = (await tx.get(teacherRef)).data() as Teacher | undefined;
    if (!teacher) fail('not-found', 'invalid', 'Teacher not found');
    const target = teacher!.uid;
    if (!target) fail('failed-precondition', 'invalid', 'This teacher is not linked');
    const memberRef = db.doc(`${paths.members(sid)}/${target}`);
    const member = (await tx.get(memberRef)).data() as Member | undefined;
    tx.update(teacherRef, { uid: FieldValue.delete() });
    if (member?.role === 'admin') tx.update(memberRef, { teacherId: FieldValue.delete() });
    else if (member) tx.delete(memberRef);
    return target!;
  });
  await syncClaims(uid);
  await auth.revokeRefreshTokens(uid);
  return { ok: true };
});
