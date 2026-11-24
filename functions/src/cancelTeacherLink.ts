// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type CancelTeacherLinkRes } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, obj, requireSchoolAdmin } from './lib/guards';
import { runTx } from './lib/tx';

export const cancelTeacherLink = onCall(callOpts, async (req): Promise<CancelTeacherLinkRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const teacherId = docId(data.teacherId, 'teacherId');
  const teacherRef = db.doc(`${paths.teachers(sid)}/${teacherId}`);
  await runTx(async (tx) => {
    const [old, teacher] = await Promise.all([
      tx.get(db.collection(paths.teacherLinks()).where('sid', '==', sid).where('teacherId', '==', teacherId)),
      tx.get(teacherRef),
    ]);
    old.docs.forEach((d) => tx.delete(d.ref));
    if (teacher.exists) tx.update(teacherRef, { inviteExpiresAt: FieldValue.delete() });
  });
  return { ok: true };
});
