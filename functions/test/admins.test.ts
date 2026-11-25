// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminWithSchool, type Client, expectFnError, linkedTeacher, signInGoogle, signUp, teacherInput, uniq } from './helpers';

const memberDoc = async (sid: string, uid: string) => (await adminDb.doc(`${paths.members(sid)}/${uid}`).get()).data();
const inviteDoc = (sid: string, email: string) => adminDb.doc(`${paths.invites(sid)}/${email}`);
// Unset until the first revoke.
const validAfter = async (uid: string) => Date.parse((await adminAuth.getUser(uid)).tokensValidAfterTime ?? '') || 0;

async function secondAdmin(admin: Client, sid: string, teacherId?: string): Promise<Client> {
  const email = `a2-${uniq()}@example.com`;
  await admin.call('inviteAdmin', { schoolId: sid, email, ...(teacherId && { teacherId }) });
  const c = await signInGoogle(email);
  await c.call('claimInvites', {});
  await c.auth.currentUser!.getIdToken(true);
  return c;
}

describe('removeAdmin', () => {
  it('refuses a stranger, a teacher of the school and an admin of another school', async () => {
    const { admin, sid } = await adminWithSchool();
    const stranger = await signUp();
    await expectFnError(stranger.call('removeAdmin', { schoolId: sid, uid: admin.uid }), 'permission-denied', 'not-allowed');
    const { teacher } = await linkedTeacher(admin, sid, 'SCC101');
    await expectFnError(teacher.call('removeAdmin', { schoolId: sid, uid: admin.uid }), 'permission-denied', 'not-allowed');
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('removeAdmin', { schoolId: sid, uid: admin.uid }), 'permission-denied', 'not-allowed');
    expect(await memberDoc(sid, admin.uid)).toMatchObject({ role: 'admin' });
  });

  it('refuses to remove the last admin, including themselves', async () => {
    const { admin, sid } = await adminWithSchool();
    const before = await validAfter(admin.uid);
    await expectFnError(admin.call('removeAdmin', { schoolId: sid, uid: admin.uid }), 'failed-precondition', 'last-admin');
    expect(await memberDoc(sid, admin.uid)).toMatchObject({ role: 'admin' });
    expect(await validAfter(admin.uid)).toBe(before);
  });

  it('refuses a member who is not an admin', async () => {
    const { admin, sid } = await adminWithSchool();
    await secondAdmin(admin, sid);
    const { teacher, teacherId } = await linkedTeacher(admin, sid, 'SCC102');
    await expectFnError(admin.call('removeAdmin', { schoolId: sid, uid: teacher.uid }), 'failed-precondition', 'invalid');
    await expectFnError(admin.call('removeAdmin', { schoolId: sid, uid: 'nobody' }), 'failed-precondition', 'invalid');
    expect(await memberDoc(sid, teacher.uid)).toMatchObject({ role: 'teacher', teacherId });
  });

  it('removes an admin, clears their claims, revokes sessions and refuses their next admin call', async () => {
    const { admin, sid } = await adminWithSchool();
    const b = await secondAdmin(admin, sid);
    expect(await b.claims()).toEqual({ schools: { [sid]: { r: 'a' } } });
    const before = await validAfter(b.uid);
    await new Promise((r) => setTimeout(r, 1100));
    await expect(admin.call('removeAdmin', { schoolId: sid, uid: b.uid })).resolves.toEqual({ role: null });
    expect(await memberDoc(sid, b.uid)).toBeUndefined();
    expect((await adminAuth.getUser(b.uid)).customClaims).toEqual({});
    expect(await validAfter(b.uid)).toBeGreaterThan(before);
    // b's cached ID token still carries the admin claim; the member doc check must refuse it.
    await expectFnError(b.call('inviteAdmin', { schoolId: sid, email: `x-${uniq()}@example.com` }), 'permission-denied', 'not-allowed');
    await expectFnError(b.call('removeAdmin', { schoolId: sid, uid: admin.uid }), 'permission-denied', 'not-allowed');
    expect(await memberDoc(sid, admin.uid)).toMatchObject({ role: 'admin' });
  });

  it('keeps an admin who is also a teacher as a teacher member', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC103') });
    const b = await secondAdmin(admin, sid, teacherId);
    expect(await memberDoc(sid, b.uid)).toMatchObject({ role: 'admin', teacherId });
    await expect(admin.call('removeAdmin', { schoolId: sid, uid: b.uid })).resolves.toEqual({ role: 'teacher' });
    expect(await memberDoc(sid, b.uid)).toMatchObject({ uid: b.uid, role: 'teacher', teacherId });
    expect((await adminAuth.getUser(b.uid)).customClaims).toEqual({ schools: { [sid]: { r: 't', t: teacherId } } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).get('uid')).toBe(b.uid);
    await expectFnError(b.call('inviteAdmin', { schoolId: sid, email: `x-${uniq()}@example.com` }), 'permission-denied', 'not-allowed');
  });

  it('lets an admin remove themselves while another admin remains', async () => {
    const { admin, sid } = await adminWithSchool();
    const b = await secondAdmin(admin, sid);
    await expect(admin.call('removeAdmin', { schoolId: sid, uid: admin.uid })).resolves.toEqual({ role: null });
    expect(await memberDoc(sid, admin.uid)).toBeUndefined();
    expect((await adminAuth.getUser(admin.uid)).customClaims).toEqual({});
    await expectFnError(b.call('removeAdmin', { schoolId: sid, uid: b.uid }), 'failed-precondition', 'last-admin');
  });

  it('leaves exactly one admin when two admins remove each other at once', async () => {
    const { admin, sid } = await adminWithSchool();
    const b = await secondAdmin(admin, sid);
    const results = await Promise.allSettled([
      admin.call('removeAdmin', { schoolId: sid, uid: b.uid }),
      b.call('removeAdmin', { schoolId: sid, uid: admin.uid }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const admins = await adminDb.collection(paths.members(sid)).where('role', '==', 'admin').get();
    expect(admins.size).toBe(1);
  });
});

describe('cancelInvite', () => {
  it('deletes a pending invite so it can no longer be claimed', async () => {
    const { admin, sid } = await adminWithSchool();
    const email = `cancel-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    await expect(admin.call('cancelInvite', { schoolId: sid, email: email.toUpperCase() })).resolves.toEqual({ ok: true });
    expect((await inviteDoc(sid, email).get()).exists).toBe(false);
    const c = await signInGoogle(email);
    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [] });
    expect(await c.claims()).toEqual({});
  });

  it('refuses an admin of another school', async () => {
    const { admin, sid } = await adminWithSchool();
    const email = `keep-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('cancelInvite', { schoolId: sid, email }), 'permission-denied', 'not-allowed');
    expect((await inviteDoc(sid, email).get()).exists).toBe(true);
  });
});

describe('requireSchoolAdmin member check', () => {
  it('refuses an admin claim whose member doc is gone or no longer admin', async () => {
    const { admin, sid } = await adminWithSchool();
    expect(await admin.claims()).toEqual({ schools: { [sid]: { r: 'a' } } });
    const ref = adminDb.doc(`${paths.members(sid)}/${admin.uid}`);
    await ref.update({ role: 'teacher' });
    await expectFnError(admin.call('inviteAdmin', { schoolId: sid, email: `x-${uniq()}@example.com` }), 'permission-denied', 'not-allowed');
    await ref.delete();
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC104') }), 'permission-denied', 'not-allowed');
  });
});
