// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { MAX_SCHOOLS, paths } from '@sathiya/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { auth } from '../src/lib/admin';
import { assertSchoolRoom, syncClaims } from '../src/lib/claims';
import { isAdminOf } from '../src/lib/guards';
import { adminAuth, adminDb, signUp, uniq } from './helpers';

const addMember = (sid: string, uid: string, m: Record<string, unknown>) => adminDb.doc(`${paths.members(sid)}/${uid}`).set({ uid, ...m });
const claimsOf = async (uid: string) => (await adminAuth.getUser(uid)).customClaims;

afterEach(() => vi.restoreAllMocks());

describe('syncClaims', () => {
  it('builds the schools map from two schools and keeps super', async () => {
    const c = await signUp();
    const [a, b] = [`a-${uniq()}`, `b-${uniq()}`];
    await adminAuth.setCustomUserClaims(c.uid, { super: true, schools: { stale: { r: 'a' } } });
    await addMember(a, c.uid, { role: 'admin' });
    await addMember(b, c.uid, { role: 'teacher', teacherId: 't1' });
    await syncClaims(c.uid);
    expect(await claimsOf(c.uid)).toEqual({ schools: { [a]: { r: 'a' }, [b]: { r: 't', t: 't1' } }, super: true });
  });

  it('keeps the teacher id on an admin member', async () => {
    const c = await signUp();
    const a = `a-${uniq()}`;
    await addMember(a, c.uid, { role: 'admin', teacherId: 't9' });
    await syncClaims(c.uid);
    expect(await claimsOf(c.uid)).toEqual({ schools: { [a]: { r: 'a', t: 't9' } } });
  });

  it('drops schools whose membership is gone and leaves no schools key when empty', async () => {
    const c = await signUp();
    const a = `a-${uniq()}`;
    await addMember(a, c.uid, { role: 'teacher', teacherId: 't1' });
    await syncClaims(c.uid);
    await adminDb.doc(`${paths.members(a)}/${c.uid}`).delete();
    await syncClaims(c.uid);
    expect(await claimsOf(c.uid)).toEqual({});
  });

  it('ignores other users’ memberships', async () => {
    const [c, d] = [await signUp(), await signUp()];
    await addMember(`a-${uniq()}`, d.uid, { role: 'admin' });
    await syncClaims(c.uid);
    expect(await claimsOf(c.uid)).toEqual({});
  });

  it('accepts the maximum number of schools with real-length ids and teacher ids', async () => {
    const c = await signUp();
    const pad = (i: number, ch: string) => `${ch}${String(i).padStart(2, '0')}`.padEnd(20, ch);
    await adminAuth.setCustomUserClaims(c.uid, { super: true });
    for (let i = 0; i < MAX_SCHOOLS; i++) await addMember(pad(i, 's'), c.uid, { role: 'admin', teacherId: pad(i, 't') });
    await syncClaims(c.uid);
    const claims = await claimsOf(c.uid);
    expect(Object.keys(claims!.schools)).toHaveLength(MAX_SCHOOLS);
    expect(claims!.super).toBe(true);
    expect(JSON.stringify(claims).length).toBeLessThan(1000);
  });

  it('republishes when memberships change while it publishes', async () => {
    const c = await signUp();
    const [a, b] = [`a-${uniq()}`, `b-${uniq()}`];
    await addMember(a, c.uid, { role: 'admin' });
    const publish = auth.setCustomUserClaims.bind(auth);
    const spy = vi.spyOn(auth, 'setCustomUserClaims').mockImplementation(async (uid, claims) => {
      await publish(uid, claims);
      if (spy.mock.calls.length === 1) await addMember(b, c.uid, { role: 'teacher', teacherId: 't1' });
    });
    await syncClaims(c.uid);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(await claimsOf(c.uid)).toEqual({ schools: { [a]: { r: 'a' }, [b]: { r: 't', t: 't1' } } });
  });

  it('publishes once when memberships hold still, and stops after three publishes', async () => {
    const c = await signUp();
    const tag = uniq();
    await addMember(`${tag}-0`, c.uid, { role: 'admin' });
    const publish = auth.setCustomUserClaims.bind(auth);
    let n = 0;
    const spy = vi.spyOn(auth, 'setCustomUserClaims').mockImplementation(async (uid, claims) => publish(uid, claims));
    await syncClaims(c.uid);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear().mockImplementation(async (uid, claims) => {
      await publish(uid, claims);
      await addMember(`${tag}-${++n}`, c.uid, { role: 'teacher' });
    });
    await syncClaims(c.uid);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('fails with too-many-schools above the limit', async () => {
    const c = await signUp();
    const tag = uniq();
    for (let i = 0; i <= MAX_SCHOOLS; i++) await addMember(`${tag}-${i}`, c.uid, { role: 'teacher', teacherId: 't' });
    await expect(syncClaims(c.uid)).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'too-many-schools' } });
  });

  it('assertSchoolRoom allows the last school, refuses one beyond the limit, and allows one it already belongs to', async () => {
    const c = await signUp();
    const tag = uniq();
    for (let i = 0; i < MAX_SCHOOLS - 1; i++) await addMember(`${tag}-${i}`, c.uid, { role: 'teacher' });
    await expect(assertSchoolRoom(c.uid, 'new1')).resolves.toBeUndefined();
    await addMember(`${tag}-last`, c.uid, { role: 'teacher' });
    await expect(assertSchoolRoom(c.uid, 'new2')).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'too-many-schools' } });
    await expect(assertSchoolRoom(c.uid, `${tag}-last`)).resolves.toBeUndefined();
  });
});

describe('isAdminOf', () => {
  it('reads the role from the schools map', () => {
    const claims = { schools: { s1: { r: 'a' as const }, s2: { r: 't' as const, t: 'x' } } };
    expect(isAdminOf(claims, 's1')).toBe(true);
    expect(isAdminOf(claims, 's2')).toBe(false);
    expect(isAdminOf(claims, 's3')).toBe(false);
    expect(isAdminOf({}, 's1')).toBe(false);
  });
});
