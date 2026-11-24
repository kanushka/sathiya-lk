// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, schoolIds, teacherIdOf, type RecordSignInRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { requireAuth, schoolDisabled } from './lib/guards';

export const SIGN_IN_THROTTLE_MS = 10 * 60_000;

export const recordSignIn = onCall(callOpts, async (req): Promise<RecordSignInRes> => {
  const { uid, claims } = requireAuth(req);
  let recorded = false;
  let disabled = false;
  for (const sid of schoolIds(claims)) {
    const tid = teacherIdOf(claims, sid);
    if (!tid) continue;
    const ref = db.doc(`${paths.teachers(sid)}/${tid}`);
    const stamped = await db.runTransaction(async (tx) => {
      const school = await tx.get(db.doc(paths.school(sid)));
      if (school.get('status') === 'disabled') return 'disabled';
      const snap = await tx.get(ref);
      if (!snap.exists || snap.get('uid') !== uid) return false;
      const now = Date.now();
      const last = snap.get('lastLoginAt') as number | undefined;
      if (typeof last === 'number' && now - last < SIGN_IN_THROTTLE_MS) return false;
      tx.update(ref, { lastLoginAt: now });
      return true;
    });
    if (stamped === 'disabled') disabled = true;
    else if (stamped) recorded = true;
  }
  if (!recorded && disabled) schoolDisabled();
  return { recorded };
});
