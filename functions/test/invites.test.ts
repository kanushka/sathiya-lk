// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminWithSchool, expectFnError, signInGoogle, signUp, teacherInput, uniq, unverifiedSignUp } from './helpers';

describe('inviteAdmin', () => {
  it('stores the invite under the lowercased email', async () => {
    const { admin, sid } = await adminWithSchool();
    const tag = uniq();
    await expect(admin.call('inviteAdmin', { schoolId: sid, email: `  New.Admin-${tag}@Example.COM ` })).resolves.toEqual({ ok: true });
    const email = `new.admin-${tag}@example.com`;
    const invite = (await adminDb.doc(`${paths.invites(sid)}/${email}`).get()).data();
    expect(invite).toMatchObject({ email, invitedBy: admin.uid });
  });

  it('refuses a non-admin of the school', async () => {
    const { sid } = await adminWithSchool();
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('inviteAdmin', { schoolId: sid, email: 'x@example.com' }), 'permission-denied', 'not-allowed');
    const stranger = await signUp();
    await expectFnError(stranger.call('inviteAdmin', { schoolId: sid, email: 'x@example.com' }), 'permission-denied', 'not-allowed');
  });

  it('rejects a bad email or unknown teacher', async () => {
    const { admin, sid } = await adminWithSchool();
    await expectFnError(admin.call('inviteAdmin', { schoolId: sid, email: 'not-an-email' }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('inviteAdmin', { schoolId: sid, email: 'a@example.com', teacherId: 'nope' }), 'invalid-argument', 'invalid');
  });
});

describe('claimInvites', () => {
  it('requires a verified email', async () => {
    const { admin, sid } = await adminWithSchool();
    const email = `unverified-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    const c = await unverifiedSignUp(email);
    await expectFnError(c.call('claimInvites', {}), 'permission-denied', 'not-allowed');
    expect((await adminDb.doc(`${paths.invites(sid)}/${email}`).get()).exists).toBe(true);
  });

  it('grants admin with tid to a verified email and deletes the invite', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC040') });
    const email = `verified-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email: email.toUpperCase(), teacherId });

    const c = await signUp(email);
    await adminAuth.updateUser(c.uid, { emailVerified: true });
    await c.auth.currentUser!.getIdToken(true);

    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [sid] });
    expect(await c.claims()).toEqual({ sid, role: 'admin', tid: teacherId });
    const member = (await adminDb.doc(`${paths.members(sid)}/${c.uid}`).get()).data();
    expect(member).toMatchObject({ uid: c.uid, role: 'admin', teacherId, email });
    expect((await adminDb.doc(`${paths.invites(sid)}/${email}`).get()).exists).toBe(false);

    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [] });
  });

  it('keeps an existing tid when a re-invite has no teacherId', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC041') });
    const email = `reinvite-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email, teacherId });
    const c = await signInGoogle(email, true);
    await c.call('claimInvites', {});

    await admin.call('inviteAdmin', { schoolId: sid, email });
    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [sid] });
    expect(await c.claims()).toEqual({ sid, role: 'admin', tid: teacherId });
    const member = (await adminDb.doc(`${paths.members(sid)}/${c.uid}`).get()).data();
    expect(member).toMatchObject({ role: 'admin', teacherId });
  });

  it('lets the founding admin link to a teacher record via a self-invite and keeps the member name', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC042') });
    await admin.call('inviteAdmin', { schoolId: sid, email: admin.auth.currentUser!.email!, teacherId });
    await expect(admin.call('claimInvites', {})).resolves.toEqual({ schoolIds: [sid] });
    expect(await admin.claims()).toEqual({ sid, role: 'admin', tid: teacherId });
    const member = (await adminDb.doc(`${paths.members(sid)}/${admin.uid}`).get()).data();
    expect(member).toMatchObject({ role: 'admin', teacherId, name: 'Principal' });
  });

  it('accepts a Google sign-in even without a verified email flag', async () => {
    const { admin, sid } = await adminWithSchool();
    const email = `google-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    const c = await signInGoogle(email, false);
    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [sid] });
    expect(await c.claims()).toEqual({ sid, role: 'admin', tid: undefined });
  });

  it('stores the invited admin’s name from their sign-in', async () => {
    const { admin, sid } = await adminWithSchool();
    const email = `named-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    const c = await signInGoogle(email, true, 'Nimal Perera');
    await c.call('claimInvites', {});
    const member = (await adminDb.doc(`${paths.members(sid)}/${c.uid}`).get()).data();
    expect(member).toMatchObject({ role: 'admin', email, name: 'Nimal Perera' });
  });

  it('skips invites of a disabled school', async () => {
    const { admin, sid } = await adminWithSchool();
    const email = `disabled-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    await adminDb.doc(paths.school(sid)).update({ status: 'disabled' });
    const c = await signInGoogle(email, true);
    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [] });
    expect(await c.claims()).toEqual({});
  });
});
