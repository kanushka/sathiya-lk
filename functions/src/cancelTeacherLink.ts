// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type CancelTeacherLinkRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, obj, requireSchoolAdmin } from './lib/guards';

export const cancelTeacherLink = onCall(callOpts, async (req): Promise<CancelTeacherLinkRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const teacherId = docId(data.teacherId, 'teacherId');
  const old = await db.collection(paths.teacherLinks()).where('sid', '==', sid).where('teacherId', '==', teacherId).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
  return { ok: true };
});
