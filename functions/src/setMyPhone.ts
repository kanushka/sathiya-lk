// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { cleanPhone, paths, type SetMyPhoneRes } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { fail, obj, requireLinkedTeacher } from './lib/guards';
import { consumeRateLimits, PHONE_PER_UID_PER_DAY } from './lib/rateLimit';

// Teachers cannot write their teacher record (firestore.rules), so the phone, and only the phone, goes through here.
export const setMyPhone = onCall(callOpts, async (req): Promise<SetMyPhoneRes> => {
  const data = obj(req.data, 'request');
  const { uid, sid, tid } = await requireLinkedTeacher(req, data.schoolId);
  const phone = cleanPhone(data.phone);
  if (phone === undefined) fail('invalid-argument', 'invalid', 'phone is not a valid phone number', { field: 'phone' });
  await consumeRateLimits([{ scope: 'my-phone-uid', id: uid, max: PHONE_PER_UID_PER_DAY }]);
  await db.doc(`${paths.teachers(sid)}/${tid}`).update({ phone: phone ?? FieldValue.delete() });
  return { phone: phone ?? null };
});
