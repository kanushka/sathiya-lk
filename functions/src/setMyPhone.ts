// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { cleanPhone, paths, type SetMyPhoneRes } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { fail, notAllowed, obj, requireLinkedTeacher } from './lib/guards';
import { consumeRateLimits, PHONE_PER_UID_PER_DAY } from './lib/rateLimit';
import { runTx } from './lib/tx';

// Teachers cannot write their teacher record (firestore.rules), so the phone, and only the phone, goes through here.
export const setMyPhone = onCall(callOpts, async (req): Promise<SetMyPhoneRes> => {
  const data = obj(req.data, 'request');
  const { uid, sid, tid } = await requireLinkedTeacher(req, data.schoolId);
  const phone = cleanPhone(data.phone);
  if (phone === undefined) fail('invalid-argument', 'invalid', 'phone is not a valid phone number', { field: 'phone' });
  await consumeRateLimits([{ scope: 'my-phone-uid', id: uid, max: PHONE_PER_UID_PER_DAY }]);
  await writeOwnPhone(sid, tid, uid, phone ?? null);
  return { phone: phone ?? null };
});

// The link is checked again inside the write: an unlink or relink between the guard and here must not let this land.
export async function writeOwnPhone(sid: string, tid: string, uid: string, phone: string | null): Promise<void> {
  const ref = db.doc(`${paths.teachers(sid)}/${tid}`);
  await runTx(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('uid') !== uid) notAllowed('Not linked to this teacher');
    tx.update(ref, { phone: phone ?? FieldValue.delete() });
  });
}
