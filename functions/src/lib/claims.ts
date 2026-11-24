// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { MAX_SCHOOLS, paths, type Claims, type Member } from '@sathiya/core';
import { auth, db } from './admin';
import { fail } from './guards';

const MEMBERS = paths.members('_').split('/').pop()!;

const tooManySchools = (): never => fail('failed-precondition', 'too-many-schools', `An account can belong to at most ${MAX_SCHOOLS} schools`);

const membersOf = (uid: string) => db.collectionGroup(MEMBERS).where('uid', '==', uid).get();

export async function assertSchoolRoom(uid: string, sid: string): Promise<void> {
  const snap = await membersOf(uid);
  if (snap.docs.some((d) => d.ref.parent.parent!.id === sid)) return;
  if (snap.size >= MAX_SCHOOLS) tooManySchools();
}

export async function syncClaims(uid: string): Promise<void> {
  const [user, snap] = await Promise.all([auth.getUser(uid), membersOf(uid)]);
  if (snap.size > MAX_SCHOOLS) tooManySchools();
  const schools: NonNullable<Claims['schools']> = {};
  for (const doc of snap.docs) {
    const m = doc.data() as Member;
    schools[doc.ref.parent.parent!.id] = { r: m.role === 'admin' ? 'a' : 't', ...(m.teacherId && { t: m.teacherId }) };
  }
  const next: Claims = {};
  if (snap.size > 0) next.schools = schools;
  if (user.customClaims?.super === true) next.super = true;
  await auth.setCustomUserClaims(uid, next);
}
