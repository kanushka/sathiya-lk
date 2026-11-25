// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type InviteAdminRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { mailConfig } from './email/params';
import { sendMail } from './email/send';
import { adminInvite } from './email/templates';
import { email, invalid, obj, optDocId, requireApprovedSchool } from './lib/guards';
import { consumeRateLimits, INVITE_PER_SCHOOL_PER_DAY, INVITE_PER_UID_PER_DAY } from './lib/rateLimit';

export const inviteAdmin = onCall(callOpts, async (req): Promise<InviteAdminRes> => {
  const data = obj(req.data, 'request');
  const { sid, uid, school, token } = await requireApprovedSchool(req, data.schoolId);
  const to = email(data.email);
  const teacherId = optDocId(data.teacherId, 'teacherId');
  if (teacherId && !(await db.doc(`${paths.teachers(sid)}/${teacherId}`).get()).exists) invalid('Teacher not found');
  // Each invite sends an email from the project domain, so cap it per admin and per school before anything is written.
  await consumeRateLimits([
    { scope: 'invite-uid', id: uid, max: INVITE_PER_UID_PER_DAY },
    { scope: 'invite-school', id: sid, max: INVITE_PER_SCHOOL_PER_DAY },
  ]);
  await db.doc(`${paths.invites(sid)}/${to}`).set({ email: to, teacherId, invitedBy: uid, createdAt: Date.now() });
  await sendMail('adminInvite', async () => {
    const { appUrl, webUrl } = mailConfig();
    const inviterEmail = token.email?.toLowerCase();
    const member = await db.doc(`${paths.members(sid)}/${uid}`).get();
    const inviter = (member.get('name') as string | undefined) || (token.name as string | undefined) || inviterEmail || 'A school admin';
    return { to: [to], replyTo: inviterEmail, message: adminInvite({ inviter, school, loginUrl: `${appUrl}/login`, webUrl }) };
  });
  return { ok: true };
});
