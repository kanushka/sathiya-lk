// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type JoinSchoolRes, type School, type Teacher } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { assertSchoolRoom, syncClaims } from './lib/claims';
import { assertApproved, fail, invalid, isVerified, notAllowed, obj, optDocId, optStr, requireAuth, str } from './lib/guards';
import { fileJoinRequest } from './lib/joinRequest';
import { linkTeacher } from './lib/linkTeacher';
import { consumeRateLimits, JOIN_PER_UID_PER_DAY, JOIN_REQUEST_PER_UID_PER_DAY } from './lib/rateLimit';
import { hashToken } from './lib/tokens';
import { runTx } from './lib/tx';

const linkInvalid = (): never => fail('failed-precondition', 'link-invalid', 'This link is not valid any more');

async function requireActive(sid: string): Promise<void> {
  const school = (await db.doc(paths.school(sid)).get()).data() as School | undefined;
  if (school) assertApproved(school.status);
  if (school?.status !== 'active') linkInvalid();
}

export const joinSchool = onCall(callOpts, async (req): Promise<JoinSchoolRes> => {
  const { uid, token: auth } = requireAuth(req);
  if (!auth.email || !isVerified(auth)) notAllowed('A verified email is required');
  const data = obj(req.data, 'request');
  const token = str(data.token, 'token', 100);
  const schoolId = optDocId(data.schoolId, 'schoolId');
  const staffId = optStr(data.staffId, 'staffId');
  const email = (auth.email as string).toLowerCase();
  const name = typeof auth.name === 'string' ? auth.name.trim() : '';
  const opts = { email, ...(name && { name }) };
  await consumeRateLimits([{ scope: 'join-uid', id: uid, max: JOIN_PER_UID_PER_DAY }]);
  const hash = hashToken(token);

  if (!schoolId) {
    const linkRef = db.doc(`${paths.teacherLinks()}/${hash}`);
    const link = (await linkRef.get()).data() as { sid: string; teacherId: string; expiresAt: number } | undefined;
    if (!link || link.expiresAt <= Date.now()) linkInvalid();
    const { sid, teacherId } = link!;
    await requireActive(sid);
    await assertSchoolRoom(uid, sid);
    await runTx(async (tx) => {
      const fresh = await tx.get(linkRef);
      if (!fresh.exists || (fresh.data() as { expiresAt: number }).expiresAt <= Date.now()) linkInvalid();
      await linkTeacher(tx, sid, teacherId, uid, opts);
    });
    await syncClaims(uid);
    return { status: 'linked', schoolId: sid, teacherId };
  }

  const stored = (await db.doc(paths.joinLink(schoolId)).get()).get('hash');
  if (typeof stored !== 'string' || stored !== hash) linkInvalid();
  await requireActive(schoolId);
  const teachers = (await db.collection(paths.teachers(schoolId)).get()).docs.map((d) => ({ ...(d.data() as Teacher), id: d.id }));

  const matches = teachers.filter((t) => !t.uid && t.email?.trim().toLowerCase() === email);
  if (matches.length === 1) {
    const teacherId = matches[0]!.id;
    await assertSchoolRoom(uid, schoolId);
    await runTx((tx) => linkTeacher(tx, schoolId, teacherId, uid, { ...opts, matchEmail: email }));
    await syncClaims(uid);
    return { status: 'linked', schoolId, teacherId };
  }

  if (!staffId) invalid('A staff ID is required');
  const teacher = teachers.find((t) => t.staffId === staffId);
  if (!teacher) fail('failed-precondition', 'staff-id-unknown', 'No teacher has this staff ID');
  if (teacher!.uid) fail('failed-precondition', 'already-linked', 'This teacher is already linked to an account', { reason: 'teacher' });
  if (teachers.some((t) => t.uid === uid)) {
    fail('failed-precondition', 'already-linked', 'This account is already linked to a teacher in this school', { reason: 'account' });
  }
  await assertSchoolRoom(uid, schoolId);
  await consumeRateLimits([{ scope: 'join-request-uid', id: uid, max: JOIN_REQUEST_PER_UID_PER_DAY }]);
  await fileJoinRequest(schoolId, teacher!.id, { uid, email, ...(name && { name }), staffId: teacher!.staffId });
  return { status: 'pending', schoolId, teacherId: teacher!.id };
});
