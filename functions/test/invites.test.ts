// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { createHash } from 'node:crypto';
import { MAX_SCHOOLS, paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminWithSchool, expectFnError, linkedTeacher, signInGoogle, signUp, teacherInput, uniq, unverifiedSignUp } from './helpers';

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
    expect(await c.claims()).toEqual({ schools: { [sid]: { r: 'a', t: teacherId } } });
    const member = (await adminDb.doc(`${paths.members(sid)}/${c.uid}`).get()).data();
    expect(member).toMatchObject({ uid: c.uid, role: 'admin', teacherId, email });
    expect((await adminDb.doc(`${paths.invites(sid)}/${email}`).get()).exists).toBe(false);
    expect((await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).get('uid')).toBe(c.uid);

    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [] });
  });

  it('grants admin without a teacher link when the invited teacher is already linked', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId, teacher } = await linkedTeacher(admin, sid, 'SCC043');
    const email = `taken-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email, teacherId });
    const c = await signInGoogle(email, true);
    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [sid] });
    expect(await c.claims()).toEqual({ schools: { [sid]: { r: 'a' } } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).get('uid')).toBe(teacher.uid);
    expect((await adminDb.doc(`${paths.invites(sid)}/${email}`).get()).exists).toBe(false);
  });

  it('keeps the existing link when a re-invite names a different teacher', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId: first } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC044') });
    const { teacherId: second } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC045') });
    const email = `switch-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email, teacherId: first });
    const c = await signInGoogle(email, true);
    await c.call('claimInvites', {});
    await admin.call('inviteAdmin', { schoolId: sid, email, teacherId: second });
    await c.call('claimInvites', {});
    expect(await c.claims()).toEqual({ schools: { [sid]: { r: 'a', t: first } } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${second}`).get()).get('uid')).toBeUndefined();
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
    expect(await c.claims()).toEqual({ schools: { [sid]: { r: 'a', t: teacherId } } });
    const member = (await adminDb.doc(`${paths.members(sid)}/${c.uid}`).get()).data();
    expect(member).toMatchObject({ role: 'admin', teacherId });
  });

  it('lets the founding admin link to a teacher record via a self-invite and keeps the member name', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC042') });
    await admin.call('inviteAdmin', { schoolId: sid, email: admin.auth.currentUser!.email!, teacherId });
    await expect(admin.call('claimInvites', {})).resolves.toEqual({ schoolIds: [sid] });
    expect(await admin.claims()).toEqual({ schools: { [sid]: { r: 'a', t: teacherId } } });
    const member = (await adminDb.doc(`${paths.members(sid)}/${admin.uid}`).get()).data();
    expect(member).toMatchObject({ role: 'admin', teacherId, name: 'Principal' });
  });

  it('accepts a Google sign-in even without a verified email flag', async () => {
    const { admin, sid } = await adminWithSchool();
    const email = `google-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    const c = await signInGoogle(email, false);
    await expect(c.call('claimInvites', {})).resolves.toEqual({ schoolIds: [sid] });
    expect(await c.claims()).toEqual({ schools: { [sid]: { r: 'a' } } });
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

  it('works when the user already belongs to another school and keeps both', async () => {
    const { admin, sid } = await adminWithSchool();
    const { admin: other, sid: otherSid } = await adminWithSchool();
    const email = other.auth.currentUser!.email!;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    await expect(other.call('claimInvites', {})).resolves.toEqual({ schoolIds: [sid] });
    expect(await other.claims()).toEqual({ schools: { [otherSid]: { r: 'a' }, [sid]: { r: 'a' } } });
  });

  it('refuses an invite that would pass the school limit and keeps the invite', async () => {
    const { admin, sid } = await adminWithSchool();
    const email = `full-${uniq()}@example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email });
    const c = await signUp(email);
    for (let i = 0; i < MAX_SCHOOLS; i++) await adminDb.doc(`${paths.members(`full${i}`)}/${c.uid}`).set({ uid: c.uid, role: 'teacher' });
    await expectFnError(c.call('claimInvites', {}), 'failed-precondition', 'too-many-schools');
    expect((await adminDb.doc(`${paths.invites(sid)}/${email}`).get()).exists).toBe(true);
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

  it('repairs missing claims of an existing member when there are no invites', async () => {
    const { admin, sid } = await adminWithSchool();
    await adminAuth.setCustomUserClaims(admin.uid, {});
    expect(await admin.claims()).toEqual({});
    await expect(admin.call('claimInvites', {})).resolves.toEqual({ schoolIds: [] });
    expect(await admin.claims()).toEqual({ schools: { [sid]: { r: 'a' } } });
  });
});

const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const teacherDoc = async (sid: string, id: string) => (await adminDb.doc(`${paths.teachers(sid)}/${id}`).get()).data()!;
const memberDoc = async (sid: string, uid: string) => (await adminDb.doc(`${paths.members(sid)}/${uid}`).get()).data();
const requestDoc = async (sid: string, uid: string) => adminDb.doc(`${paths.joinRequests(sid)}/${uid}`).get();

async function school(staffIds: string[] = ['SCC001'], emails: Record<string, string> = {}) {
  const { admin, sid } = await adminWithSchool();
  const ids: string[] = [];
  for (const staffId of staffIds) {
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput(staffId), ...(emails[staffId] && { email: emails[staffId] }) } });
    ids.push(teacherId);
  }
  const { token } = await admin.call('setJoinLink', { schoolId: sid, action: 'create' });
  return { admin, sid, ids, token: token! };
}

describe('setJoinLink', () => {
  it('stores the hash and the token for admins, replaces on create, deletes on off', async () => {
    const { admin, sid, token } = await school();
    const doc = (await adminDb.doc(paths.joinLink(sid)).get()).data()!;
    expect(doc).toMatchObject({ hash: sha(token), token, createdBy: admin.uid });
    expect(typeof doc.createdAt).toBe('number');
    const { token: next } = await admin.call('setJoinLink', { schoolId: sid, action: 'create' });
    expect((await adminDb.doc(paths.joinLink(sid)).get()).data()).toMatchObject({ hash: sha(next!), token: next });
    await expect(admin.call('setJoinLink', { schoolId: sid, action: 'off' })).resolves.toEqual({});
    expect((await adminDb.doc(paths.joinLink(sid)).get()).exists).toBe(false);
  });
});

describe('joinSchool with a school link', () => {
  it('links the single teacher whose email matches', async () => {
    const email = `t-${uniq()}@example.com`;
    const { sid, ids, token } = await school(['SCC001', 'SCC002'], { SCC001: email.toUpperCase() });
    const u = await signUp(email);
    await expect(u.call('joinSchool', { schoolId: sid, token })).resolves.toEqual({ status: 'linked', schoolId: sid, teacherId: ids[0] });
    expect(await u.claims()).toEqual({ schools: { [sid]: { r: 't', t: ids[0] } } });
    expect((await teacherDoc(sid, ids[0]!)).uid).toBe(u.uid);
  });

  it('needs a staff ID when emails are duplicated, then queues a request', async () => {
    const email = `d-${uniq()}@example.com`;
    const { sid, ids, token } = await school(['SCC001', 'SCC002'], { SCC001: email, SCC002: email });
    const u = await signUp(email);
    await expectFnError(u.call('joinSchool', { schoolId: sid, token }), 'invalid-argument', 'invalid');
    await expect(u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC002' })).resolves.toEqual({ status: 'pending', schoolId: sid, teacherId: ids[1] });
    expect((await requestDoc(sid, u.uid)).data()).toMatchObject({ uid: u.uid, email, staffId: 'SCC002', teacherId: ids[1], status: 'pending' });
    expect(await u.claims()).toEqual({});
  });

  it('refuses an unknown staff ID and a linked teacher', async () => {
    const { admin, sid, token } = await school();
    const u = await signUp();
    await expectFnError(u.call('joinSchool', { schoolId: sid, token, staffId: 'NOPE' }), 'failed-precondition', 'staff-id-unknown');
    await linkedTeacher(admin, sid, 'SCC009');
    await expectFnError(u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC009' }), 'failed-precondition', 'already-linked');
  });

  it('refuses a token of another school, and an off link', async () => {
    const a = await school();
    const b = await school();
    const u = await signUp();
    await expectFnError(u.call('joinSchool', { schoolId: a.sid, token: b.token, staffId: 'SCC001' }), 'failed-precondition', 'link-invalid');
    await a.admin.call('setJoinLink', { schoolId: a.sid, action: 'off' });
    await expectFnError(u.call('joinSchool', { schoolId: a.sid, token: a.token, staffId: 'SCC001' }), 'failed-precondition', 'link-invalid');
  });

  it('requires a verified email', async () => {
    const { sid, token } = await school();
    const u = await unverifiedSignUp();
    await expectFnError(u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' }), 'permission-denied', 'not-allowed');
  });

  it('limits join requests per account per day', async () => {
    const { sid, token } = await school();
    const u = await signUp();
    for (let i = 0; i < 5; i++) await u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' });
    await expectFnError(u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' }), 'resource-exhausted', 'rate-limited');
  });

  it('refuses when the account is at the school cap', async () => {
    const { sid, token } = await school();
    const u = await signUp();
    await Promise.all(Array.from({ length: MAX_SCHOOLS }, (_, i) => adminDb.doc(`${paths.members(`cap-${i}`)}/${u.uid}`).set({ uid: u.uid, role: 'teacher' })));
    await expectFnError(u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' }), 'failed-precondition', 'too-many-schools');
  });
});

describe('joinSchool with a personal link', () => {
  it('links once; the second use is link-invalid', async () => {
    const { admin, sid, ids } = await school();
    const { token } = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    const u = await signUp();
    await expect(u.call('joinSchool', { token })).resolves.toEqual({ status: 'linked', schoolId: sid, teacherId: ids[0] });
    expect(await memberDoc(sid, u.uid)).toMatchObject({ role: 'teacher', teacherId: ids[0] });
    expect((await adminDb.doc(`${paths.teacherLinks()}/${sha(token)}`).get()).exists).toBe(false);
    const v = await signUp();
    await expectFnError(v.call('joinSchool', { token }), 'failed-precondition', 'link-invalid');
  });

  it('refuses an expired link', async () => {
    const { admin, sid, ids } = await school();
    const { token } = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    await adminDb.doc(`${paths.teacherLinks()}/${sha(token)}`).update({ expiresAt: Date.now() - 1 });
    const u = await signUp();
    await expectFnError(u.call('joinSchool', { token }), 'failed-precondition', 'link-invalid');
  });

  it('drops the account own pending request when it links', async () => {
    const { admin, sid, ids } = await school(['SCC001', 'SCC002']);
    const u = await signUp();
    const { token: joinToken } = await admin.call('setJoinLink', { schoolId: sid, action: 'create' });
    await u.call('joinSchool', { schoolId: sid, token: joinToken!, staffId: 'SCC002' });
    const { token } = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    await u.call('joinSchool', { token });
    expect((await requestDoc(sid, u.uid)).exists).toBe(false);
  });
});

describe('createTeacherLink and cancelTeacherLink', () => {
  it('replaces the previous link, expires in 7 days, and can be cancelled', async () => {
    const { admin, sid, ids } = await school();
    const first = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    const second = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    expect((await adminDb.doc(`${paths.teacherLinks()}/${sha(first.token)}`).get()).exists).toBe(false);
    const doc = (await adminDb.doc(`${paths.teacherLinks()}/${sha(second.token)}`).get()).data()!;
    expect(doc).toMatchObject({ sid, teacherId: ids[0], createdBy: admin.uid, expiresAt: second.expiresAt });
    expect(second.expiresAt - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
    await expect(admin.call('cancelTeacherLink', { schoolId: sid, teacherId: ids[0]! })).resolves.toEqual({ ok: true });
    expect((await adminDb.doc(`${paths.teacherLinks()}/${sha(second.token)}`).get()).exists).toBe(false);
  });

  it('keeps inviteExpiresAt on the teacher until cancel or redeem', async () => {
    const { admin, sid, ids } = await school(['SCC001', 'SCC002']);
    const first = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    expect((await teacherDoc(sid, ids[0]!)).inviteExpiresAt).toBe(first.expiresAt);
    await admin.call('cancelTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    expect((await teacherDoc(sid, ids[0]!)).inviteExpiresAt).toBeUndefined();

    const second = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[1]! });
    expect((await teacherDoc(sid, ids[1]!)).inviteExpiresAt).toBe(second.expiresAt);
    await (await signUp()).call('joinSchool', { token: second.token });
    expect((await teacherDoc(sid, ids[1]!)).inviteExpiresAt).toBeUndefined();
  });

  it('refuses a linked teacher', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await linkedTeacher(admin, sid, 'SCC005');
    await expectFnError(admin.call('createTeacherLink', { schoolId: sid, teacherId }), 'failed-precondition', 'already-linked');
  });
});

describe('decideJoinRequest', () => {
  it('approve links the teacher and removes the request', async () => {
    const { admin, sid, ids, token } = await school();
    const u = await signUp();
    await u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' });
    await expect(admin.call('decideJoinRequest', { schoolId: sid, uid: u.uid, approve: true })).resolves.toEqual({ ok: true });
    expect(await u.claims()).toEqual({ schools: { [sid]: { r: 't', t: ids[0] } } });
    expect((await requestDoc(sid, u.uid)).exists).toBe(false);
  });

  it('reject keeps the request as rejected and links nothing', async () => {
    const { admin, sid, ids, token } = await school();
    const u = await signUp();
    await u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' });
    await admin.call('decideJoinRequest', { schoolId: sid, uid: u.uid, approve: false });
    const doc = (await requestDoc(sid, u.uid)).data()!;
    expect(doc).toMatchObject({ uid: u.uid, teacherId: ids[0], status: 'rejected' });
    expect(typeof doc.decidedAt).toBe('number');
    expect((await teacherDoc(sid, ids[0]!)).uid).toBeUndefined();
    expect(await u.claims()).toEqual({});
  });

  it('refuses to approve or reject a rejected request', async () => {
    const { admin, sid, ids, token } = await school();
    const u = await signUp();
    await u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' });
    await admin.call('decideJoinRequest', { schoolId: sid, uid: u.uid, approve: false });
    await expectFnError(admin.call('decideJoinRequest', { schoolId: sid, uid: u.uid, approve: true }), 'failed-precondition', 'invalid');
    await expectFnError(admin.call('decideJoinRequest', { schoolId: sid, uid: u.uid, approve: false }), 'failed-precondition', 'invalid');
    expect((await teacherDoc(sid, ids[0]!)).uid).toBeUndefined();
    expect(await u.claims()).toEqual({});
  });

  it('a rejected user can file again, which makes the request pending', async () => {
    const { admin, sid, ids, token } = await school(['SCC001', 'SCC002']);
    const u = await signUp();
    await u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' });
    await admin.call('decideJoinRequest', { schoolId: sid, uid: u.uid, approve: false });
    await expect(u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC002' })).resolves.toEqual({ status: 'pending', schoolId: sid, teacherId: ids[1] });
    const doc = (await requestDoc(sid, u.uid)).data()!;
    expect(doc).toMatchObject({ staffId: 'SCC002', teacherId: ids[1], status: 'pending' });
    expect(doc.decidedAt).toBeUndefined();
  });

  it('linking the teacher by a personal link rejects the other request, which cannot then be approved', async () => {
    const { admin, sid, ids, token } = await school();
    const u = await signUp();
    await u.call('joinSchool', { schoolId: sid, token, staffId: 'SCC001' });
    const { token: personal } = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    const other = await signUp();
    await other.call('joinSchool', { token: personal });
    expect((await requestDoc(sid, u.uid)).data()).toMatchObject({ status: 'rejected' });
    await expectFnError(admin.call('decideJoinRequest', { schoolId: sid, uid: u.uid, approve: true }), 'failed-precondition', 'invalid');
    expect((await teacherDoc(sid, ids[0]!)).uid).toBe(other.uid);
  });

  it('approving a stale request for a linked teacher is already-linked', async () => {
    const { admin, sid, ids } = await school();
    const u = await signUp();
    const { token: personal } = await admin.call('createTeacherLink', { schoolId: sid, teacherId: ids[0]! });
    await (await signUp()).call('joinSchool', { token: personal });
    await adminDb.doc(`${paths.joinRequests(sid)}/${u.uid}`).set({ uid: u.uid, email: 'x@example.com', staffId: 'SCC001', teacherId: ids[0], createdAt: Date.now() });
    await expectFnError(admin.call('decideJoinRequest', { schoolId: sid, uid: u.uid, approve: true }), 'failed-precondition', 'already-linked');
  });
});

describe('unlinkTeacher', () => {
  it('removes a teacher member, clears claims and revokes sessions', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacher, teacherId } = await linkedTeacher(admin, sid, 'SCC006');
    const before = Date.parse((await adminAuth.getUser(teacher.uid)).tokensValidAfterTime!);
    await new Promise((r) => setTimeout(r, 1100));
    await expect(admin.call('unlinkTeacher', { schoolId: sid, teacherId })).resolves.toEqual({ ok: true });
    expect((await teacherDoc(sid, teacherId)).uid).toBeUndefined();
    expect(await memberDoc(sid, teacher.uid)).toBeUndefined();
    expect((await adminAuth.getUser(teacher.uid)).customClaims).toEqual({});
    expect(Date.parse((await adminAuth.getUser(teacher.uid)).tokensValidAfterTime!)).toBeGreaterThan(before);
  });

  it('keeps the admin role of an admin who is also a teacher', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC007') });
    await admin.call('linkSelf', { schoolId: sid, teacherId });
    expect(await memberDoc(sid, admin.uid)).toMatchObject({ role: 'admin', teacherId });
    await admin.call('unlinkTeacher', { schoolId: sid, teacherId });
    const member = (await memberDoc(sid, admin.uid))!;
    expect(member.role).toBe('admin');
    expect(member.teacherId).toBeUndefined();
    expect((await adminAuth.getUser(admin.uid)).customClaims).toEqual({ schools: { [sid]: { r: 'a' } } });
  });
});

describe('linkSelf', () => {
  it('links the admin and refuses a taken teacher', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC008') });
    await admin.call('linkSelf', { schoolId: sid, teacherId });
    expect(await admin.claims()).toEqual({ schools: { [sid]: { r: 'a', t: teacherId } } });
    const { teacherId: other } = await linkedTeacher(admin, sid, 'SCC010');
    await expectFnError(admin.call('linkSelf', { schoolId: sid, teacherId: other }), 'failed-precondition', 'already-linked');
  });
});

describe('admin-only invite callables', () => {
  it.each(['setJoinLink', 'decideJoinRequest', 'createTeacherLink', 'cancelTeacherLink', 'unlinkTeacher', 'linkSelf'] as const)('%s refuses a non-admin', async (name) => {
    const { sid } = await adminWithSchool();
    const stranger = await signUp();
    await expectFnError(stranger.call(name, { schoolId: sid, teacherId: 't', uid: 'u', approve: true, action: 'create' } as never), 'permission-denied', 'not-allowed');
  });
});
