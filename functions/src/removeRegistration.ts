// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type RemoveRegistrationRes } from '@sathiya/core';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { syncClaims } from './lib/claims';
import { fail, obj, requireSchoolAdmin } from './lib/guards';

export const removeRegistration = onCall(callOpts, async (req): Promise<RemoveRegistrationRes> => {
  const data = obj(req.data, 'request');
  const { sid, school } = await requireSchoolAdmin(req, data.schoolId);
  if (school.status !== 'rejected') fail('failed-precondition', 'invalid', 'Only a school that was not approved can be removed');

  const schoolRef = db.doc(paths.school(sid));
  const [members, links] = await Promise.all([
    db.collection(paths.members(sid)).get(),
    db.collection(paths.teacherLinks()).where('sid', '==', sid).get(),
  ]);
  const uids = [...new Set(members.docs.map((d) => (d.get('uid') as string | undefined) ?? d.id))];

  const writer = db.bulkWriter();
  for (const l of links.docs) void writer.delete(l.ref);
  void writer.delete(db.doc(paths.directory(sid)));
  await writer.close();
  // recursiveDelete(schoolRef) would delete the school doc even when a descendant delete fails, and a retry is refused
  // once the doc is gone. Deleting the subcollections first keeps the doc until everything under it is gone.
  for (const c of await schoolRef.listCollections()) await db.recursiveDelete(c);
  await schoolRef.delete();
  await getStorage()
    .bucket()
    .deleteFiles({ prefix: `schools/${sid}/` })
    .catch((e) => logger.error('removeRegistration: storage cleanup failed', { sid, e }));
  // The school is gone, so a throw would only invite a retry that is refused; claimInvites re-syncs on the next sign-in.
  await Promise.all(uids.map((u) => syncClaims(u).catch((e) => logger.error('removeRegistration: claims sync failed', { sid, uid: u, e }))));
  return { ok: true };
});
