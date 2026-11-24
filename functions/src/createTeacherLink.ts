// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type CreateTeacherLinkRes, type Teacher } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, fail, obj, requireSchoolAdmin } from './lib/guards';
import { consumeRateLimits, TEACHER_LINK_PER_SCHOOL_PER_DAY } from './lib/rateLimit';
import { hashToken, newToken } from './lib/tokens';
import { runTx } from './lib/tx';

const WEEK_MS = 7 * 86_400_000;

export const createTeacherLink = onCall(callOpts, async (req): Promise<CreateTeacherLinkRes> => {
  const data = obj(req.data, 'request');
  const { sid, uid } = await requireSchoolAdmin(req, data.schoolId);
  const teacherId = docId(data.teacherId, 'teacherId');
  const teacher = (await db.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data() as Teacher | undefined;
  if (!teacher) fail('not-found', 'invalid', 'Teacher not found');
  if (teacher!.uid) fail('failed-precondition', 'already-linked', 'This teacher is already linked to an account');
  await consumeRateLimits([{ scope: 'teacher-link-school', id: sid, max: TEACHER_LINK_PER_SCHOOL_PER_DAY }]);
  const token = newToken();
  const expiresAt = Date.now() + WEEK_MS;
  const links = db.collection(paths.teacherLinks());
  await runTx(async (tx) => {
    const old = await tx.get(links.where('sid', '==', sid).where('teacherId', '==', teacherId));
    old.docs.forEach((d) => tx.delete(d.ref));
    tx.set(links.doc(hashToken(token)), { sid, teacherId, expiresAt, createdBy: uid });
  });
  return { token, expiresAt };
});
