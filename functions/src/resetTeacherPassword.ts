// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type ResetTeacherPasswordRes, type Teacher } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, fail, obj, requireSchoolAdmin } from './lib/guards';
import { newPassword } from './lib/password';

export const resetTeacherPassword = onCall(callOpts, async (req): Promise<ResetTeacherPasswordRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const teacherId = docId(data.teacherId, 'teacherId');
  const teacher = (await db.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data() as Teacher | undefined;
  if (!teacher) fail('not-found', 'invalid', 'Teacher not found');
  if (!teacher!.uid) fail('failed-precondition', 'invalid', 'Teacher has no login account');
  const password = newPassword();
  await auth.updateUser(teacher!.uid!, { password });
  await auth.revokeRefreshTokens(teacher!.uid!);
  return { password };
});
