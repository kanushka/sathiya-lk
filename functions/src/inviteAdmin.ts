import { paths, type InviteAdminRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { email, invalid, obj, optStr, requireSchoolAdmin } from './lib/guards';

export const inviteAdmin = onCall(callOpts, async (req): Promise<InviteAdminRes> => {
  const data = obj(req.data, 'request');
  const { sid, uid } = await requireSchoolAdmin(req, data.schoolId);
  const to = email(data.email);
  const teacherId = optStr(data.teacherId, 'teacherId');
  if (teacherId && !(await db.doc(`${paths.teachers(sid)}/${teacherId}`).get()).exists) invalid('Teacher not found');
  await db.doc(`${paths.invites(sid)}/${to}`).set({ email: to, teacherId, invitedBy: uid, createdAt: Date.now() });
  return { ok: true };
});
