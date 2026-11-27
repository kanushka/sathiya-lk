// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Bilingual, type DecideNameChangeRes, type SchoolNameChange } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { mailConfig } from './email/params';
import { sendMail } from './email/send';
import { nameChangeApproved, nameChangeRejected } from './email/templates';
import { adminEmails } from './lib/adminEmails';
import { callOpts } from './lib/callOptions';
import { directoryFields, listed } from './lib/directory';
import { bool, docId, fail, int, obj, requireSuper, str } from './lib/guards';
import { runTx } from './lib/tx';

const REASON_MAX = 500;

export const decideNameChange = onCall(callOpts, async (req): Promise<DecideNameChangeRes> => {
  const { uid } = requireSuper(req);
  const data = obj(req.data, 'request');
  const sid = docId(data.schoolId, 'schoolId');
  const requestedAt = int(data.requestedAt, 'requestedAt', 0, Number.MAX_SAFE_INTEGER);
  const approve = bool(data.approve, 'approve');
  const reason = approve ? undefined : str(data.reason, 'reason', REASON_MAX);
  const schoolRef = db.doc(paths.school(sid));
  const now = Date.now();
  const { before, change } = await runTx(async (tx) => {
    const snap = await tx.get(schoolRef);
    if (!snap.exists) fail('not-found', 'invalid', 'School not found');
    const nc = snap.get('nameChange') as SchoolNameChange | undefined;
    if (nc?.status !== 'pending') fail('failed-precondition', 'invalid', 'No name change is waiting for review');
    if (nc!.requestedAt !== requestedAt) fail('failed-precondition', 'stale', 'The school sent a newer name change request');
    if (approve) {
      const names = { nameEn: nc!.nameEn, nameSi: nc!.nameSi };
      tx.update(schoolRef, { nameEn: names.nameEn, nameSi: names.nameSi ?? FieldValue.delete(), nameChange: FieldValue.delete() });
      if (listed(snap.get('status'))) tx.set(db.doc(paths.directory(sid)), directoryFields({ ...snap.data(), ...names }));
    } else {
      tx.update(schoolRef, { 'nameChange.status': 'rejected', 'nameChange.reason': reason, 'nameChange.decidedAt': now, 'nameChange.decidedBy': uid });
    }
    return { before: snap, change: nc! };
  });
  const requested: Bilingual = change.nameSi === undefined ? { nameEn: change.nameEn } : { nameEn: change.nameEn, nameSi: change.nameSi };
  await sendMail(approve ? 'nameChangeApproved' : 'nameChangeRejected', async () => {
    const { appUrl, replyTo } = mailConfig();
    const brand = { logoUrl: before.get('logoUrl') as string | undefined, colors: before.get('colors') as { primary?: string } | undefined };
    const oldName = { nameEn: (before.get('nameEn') as string | undefined) ?? '', nameSi: before.get('nameSi') as string | undefined };
    const message = approve
      ? nameChangeApproved({ school: { ...brand, ...requested }, oldName, adminUrl: `${appUrl}/s/${sid}/admin/profile` })
      : nameChangeRejected({ school: { ...brand, ...oldName }, requested, reason: reason!, contactEmail: replyTo });
    return { to: await adminEmails(sid), message };
  });
  return { ok: true };
});
