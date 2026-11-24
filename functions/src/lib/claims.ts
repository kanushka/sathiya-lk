// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { MAX_SCHOOLS, paths, type Claims, type Member } from '@sathiya/core';
import { logger } from 'firebase-functions/logger';
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

// Joins stop at MAX_SCHOOLS, but a race can pass it. Throwing here would leave the claims unrepairable, so publish a
// stable subset (admin memberships first, then by school id) and log it.
function schoolsOf(snap: MemberSnap, uid: string): Claims['schools'] {
  if (snap.size === 0) return undefined;
  const entries = snap.docs
    .map((doc) => ({ sid: doc.ref.parent.parent!.id, m: doc.data() as Member }))
    .sort((a, b) => Number(b.m.role === 'admin') - Number(a.m.role === 'admin') || (a.sid < b.sid ? -1 : a.sid > b.sid ? 1 : 0));
  if (entries.length > MAX_SCHOOLS) logger.error('Account is over the school limit; publishing a subset of its memberships', { uid, count: entries.length });
  const schools: NonNullable<Claims['schools']> = {};
  for (const { sid, m } of entries.slice(0, MAX_SCHOOLS)) schools[sid] = { r: m.role === 'admin' ? 'a' : 't', ...(m.teacherId && { t: m.teacherId }) };
  return schools;
}

const SYNC_ATTEMPTS = 3;

// Claims are replaced whole, so a concurrent sync can publish an older snapshot over a newer one. Re-reading after each
// publish and republishing on a difference narrows that window; the next sign-in (claimInvites) repairs what is left.
export async function syncClaims(uid: string): Promise<void> {
  const [user, first] = await Promise.all([auth.getUser(uid), membersOf(uid)]);
  let schools = schoolsOf(first, uid);
  for (let i = 1; ; i++) {
    const next: Claims = {};
    if (schools) next.schools = schools;
    if (user.customClaims?.super === true) next.super = true;
    await auth.setCustomUserClaims(uid, next);
    if (i >= SYNC_ATTEMPTS) return;
    const now = schoolsOf(await membersOf(uid), uid);
    if (JSON.stringify(now) === JSON.stringify(schools)) return;
    schools = now;
  }
}

// For accounts revoked before a commit that removed their membership: a session started between that revoke and the
// commit holds stale claims, so revoke again after the sync, even when the sync fails.
export async function syncClaimsAndRevoke(uids: string[]): Promise<void> {
  try {
    await Promise.all(uids.map((u) => syncClaims(u)));
  } finally {
    await Promise.all(uids.map((u) => auth.revokeRefreshTokens(u)));
  }
}
