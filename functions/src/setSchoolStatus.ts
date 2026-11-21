// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type SetSchoolStatusRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { mailConfig } from './email/params';
import { sendMail } from './email/send';
import { schoolReactivated, schoolSuspended } from './email/templates';
import { callOpts } from './lib/callOptions';
import { docId, fail, invalid, obj, requireSuper } from './lib/guards';

export const setSchoolStatus = onCall(callOpts, async (req): Promise<SetSchoolStatusRes> => {
  requireSuper(req);
  const data = obj(req.data, 'request');
  const sid = docId(data.schoolId, 'schoolId');
  const status = data.status;
  if (status !== 'active' && status !== 'disabled') invalid('status must be active or disabled');
  const schoolRef = db.doc(paths.school(sid));
  let before: FirebaseFirestore.DocumentSnapshot | undefined;
  await db.runTransaction(async (tx) => {
    before = await tx.get(schoolRef);
    if (!before.exists) fail('not-found', 'invalid', 'School not found');
    tx.update(schoolRef, { status });
    tx.set(db.doc(paths.directory(sid)), { status }, { merge: true });
  });
  if ((before!.get('status') ?? 'active') !== status) {
    await sendMail(`school ${status}`, async () => {
      const { appUrl, webUrl } = mailConfig();
      const admins = await db.collection(paths.members(sid)).where('role', '==', 'admin').get();
      const to = admins.docs.map((d) => d.get('email') as string | undefined).filter((e): e is string => !!e);
      const school = { nameEn: before!.get('nameEn') as string, nameSi: before!.get('nameSi') as string | undefined, logoUrl: before!.get('logoUrl') as string | undefined, colors: before!.get('colors') as { primary?: string } | undefined };
      const input = { school, loginUrl: `${appUrl}/login`, webUrl };
      return { to, message: status === 'disabled' ? schoolSuspended(input) : schoolReactivated(input) };
    });
  }
  return { ok: true };
});
