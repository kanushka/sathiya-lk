// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type RecordSignInRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { requireAuth, schoolDisabled } from './lib/guards';

export const SIGN_IN_THROTTLE_MS = 10 * 60_000;

export const recordSignIn = onCall(callOpts, async (req): Promise<RecordSignInRes> => {
  const { uid, claims } = requireAuth(req);
  const { sid, tid, role } = claims;
  if (!sid || !tid || (role !== 'teacher' && role !== 'admin')) return { recorded: false };
  const ref = db.doc(`${paths.teachers(sid)}/${tid}`);
  return db.runTransaction(async (tx) => {
    const school = await tx.get(db.doc(paths.school(sid)));
    if (school.get('status') === 'disabled') schoolDisabled();
    const snap = await tx.get(ref);
    if (!snap.exists) return { recorded: false };
    if (role === 'teacher' && snap.get('uid') !== uid) return { recorded: false };
    const now = Date.now();
    const last = snap.get('lastLoginAt') as number | undefined;
    if (typeof last === 'number' && now - last < SIGN_IN_THROTTLE_MS) return { recorded: false };
    tx.update(ref, { lastLoginAt: now });
    return { recorded: true };
  });
});
