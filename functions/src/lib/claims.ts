// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { MAX_SCHOOLS, paths, type Claims, type Member } from '@sathiya/core';
import { auth, db } from './admin';
import { fail } from './guards';

const MEMBERS = paths.members('_').split('/').pop()!;

const tooManySchools = (): never => fail('failed-precondition', 'too-many-schools', `An account can belong to at most ${MAX_SCHOOLS} schools`);

const membersOf = (uid: string) => db.collectionGroup(MEMBERS).where('uid', '==', uid).get();

export async function hasSchoolRoom(uid: string, sid: string): Promise<boolean> {
  const snap = await membersOf(uid);
  return snap.docs.some((d) => d.ref.parent.parent!.id === sid) || snap.size < MAX_SCHOOLS;
}

export async function assertSchoolRoom(uid: string, sid: string): Promise<void> {
  if (!(await hasSchoolRoom(uid, sid))) tooManySchools();
}

type MemberSnap = Awaited<ReturnType<typeof membersOf>>;

function schoolsOf(snap: MemberSnap): Claims['schools'] {
  if (snap.size > MAX_SCHOOLS) tooManySchools();
  if (snap.size === 0) return undefined;
  const schools: NonNullable<Claims['schools']> = {};
  for (const doc of [...snap.docs].sort((a, b) => a.ref.path.localeCompare(b.ref.path))) {
    const m = doc.data() as Member;
    schools[doc.ref.parent.parent!.id] = { r: m.role === 'admin' ? 'a' : 't', ...(m.teacherId && { t: m.teacherId }) };
  }
  return schools;
}

const SYNC_ATTEMPTS = 3;

// Claims are replaced whole, so a concurrent sync can publish an older snapshot over a newer one. Re-reading after each
// publish and republishing on a difference narrows that window; the next sign-in (claimInvites) repairs what is left.
export async function syncClaims(uid: string): Promise<void> {
  const [user, first] = await Promise.all([auth.getUser(uid), membersOf(uid)]);
  let schools = schoolsOf(first);
  for (let i = 1; ; i++) {
    const next: Claims = {};
    if (schools) next.schools = schools;
    if (user.customClaims?.super === true) next.super = true;
    await auth.setCustomUserClaims(uid, next);
    if (i >= SYNC_ATTEMPTS) return;
    const now = schoolsOf(await membersOf(uid));
    if (JSON.stringify(now) === JSON.stringify(schools)) return;
    schools = now;
  }
}
