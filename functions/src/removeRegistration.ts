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

const MEMBERS = paths.members('_').split('/').pop()!;

// Every step before the school doc delete is idempotent, so a failed run is retried by calling again: the school doc,
// and with it the admin's access and the uids to re-sync, stays until everything under it is gone.
export const removeRegistration = onCall(callOpts, async (req): Promise<RemoveRegistrationRes> => {
  const data = obj(req.data, 'request');
  const { sid, school } = await requireSchoolAdmin(req, data.schoolId, { allowRejected: true });
  const removing = (school as { removing?: { uids?: string[] } }).removing;
  if (school.status !== 'rejected' && !removing) fail('failed-precondition', 'invalid', 'Only a school that was not approved can be removed');

  const schoolRef = db.doc(paths.school(sid));
  const [members, links] = await Promise.all([
    db.collection(paths.members(sid)).get(),
    db.collection(paths.teacherLinks()).where('sid', '==', sid).get(),
  ]);
  const uids = [...new Set([...(removing?.uids ?? []), ...members.docs.map((d) => (d.get('uid') as string | undefined) ?? d.id)])];
  await schoolRef.update({ removing: { uids, at: Date.now() } });

  const writer = db.bulkWriter();
  for (const l of links.docs) void writer.delete(l.ref);
  void writer.delete(db.doc(paths.directory(sid)));
  await writer.close();
  // recursiveDelete(schoolRef) would delete the school doc even when a descendant delete fails.
  const subs = await schoolRef.listCollections();
  for (const c of subs.filter((c) => c.id !== MEMBERS)) await db.recursiveDelete(c);
  await db.recursiveDelete(db.collection(paths.members(sid)));
  await getStorage().bucket().deleteFiles({ prefix: `schools/${sid}/` });
  await schoolRef.delete();
  // The school is gone, so a throw would only invite a retry that is refused; claimInvites re-syncs on the next sign-in.
  await Promise.all(uids.map((u) => syncClaims(u).catch((e) => logger.error('removeRegistration: claims sync failed', { sid, uid: u, e }))));
  return { ok: true };
});
