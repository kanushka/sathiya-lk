// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type ReviewSchoolRes } from '@sathiya/core';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { mailConfig } from './email/params';
import { sendMail } from './email/send';
import { schoolApproved, schoolRejected } from './email/templates';
import { callOpts } from './lib/callOptions';
import { releaseCensus } from './lib/census';
import { directoryFields } from './lib/directory';
import { bool, docId, fail, obj, requireSuper, str } from './lib/guards';
import { runTx } from './lib/tx';

const REASON_MAX = 500;

async function adminEmails(sid: string): Promise<string[]> {
  const admins = await db.collection(paths.members(sid)).where('role', '==', 'admin').get();
  const emails = await Promise.all(
    admins.docs.map(async (d) => (d.get('email') as string | undefined) || (await auth.getUser(d.id).catch(() => undefined))?.email),
  );
  return emails.filter((e): e is string => !!e);
}

export const reviewSchool = onCall(callOpts, async (req): Promise<ReviewSchoolRes> => {
  const { uid } = requireSuper(req);
  const data = obj(req.data, 'request');
  const sid = docId(data.schoolId, 'schoolId');
  const approve = bool(data.approve, 'approve');
  const reason = approve ? undefined : str(data.reason, 'reason', REASON_MAX);
  const schoolRef = db.doc(paths.school(sid));
  const now = Date.now();
  const before: DocumentSnapshot = await runTx(async (tx) => {
    const snap = await tx.get(schoolRef);
    if (!snap.exists) fail('not-found', 'invalid', 'School not found');
    if (snap.get('status') !== 'pending') fail('failed-precondition', 'invalid', 'School is not waiting for review');
    const decided = { 'review.decidedAt': now, 'review.decidedBy': uid };
    if (approve) {
      tx.update(schoolRef, { status: 'active', ...decided });
      tx.set(db.doc(paths.directory(sid)), directoryFields({ ...snap.data(), status: 'active' }));
    } else {
      await releaseCensus(tx, snap, uid);
      tx.update(schoolRef, { status: 'rejected', 'review.reason': reason, ...decided });
    }
    return snap;
  });
  await sendMail(approve ? 'schoolApproved' : 'schoolRejected', async () => {
    const { appUrl, replyTo } = mailConfig();
    const school = {
      nameEn: before.get('nameEn') as string,
      nameSi: before.get('nameSi') as string | undefined,
      logoUrl: before.get('logoUrl') as string | undefined,
      colors: before.get('colors') as { primary?: string } | undefined,
    };
    const message = approve ? schoolApproved({ school, adminUrl: `${appUrl}/s/${sid}/admin` }) : schoolRejected({ school, reason: reason!, contactEmail: replyTo });
    return { to: await adminEmails(sid), message };
  });
  return { ok: true };
});
