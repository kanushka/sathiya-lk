// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, syntheticEmail } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminWithSchool, expectFnError, makeSuper, signIn, signUp, teacherInput } from './helpers';

describe('createTeacher', () => {
  it('creates an auth account the teacher can sign in with', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId, password } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC024') });
    expect(password).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);

    const teacher = (await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data()!;
    expect(teacher).toMatchObject({ staffId: 'SCC024', name: 'Mrs. K. Perera', grades: [6, 7], maxPerDay: 6 });
    expect(teacher.uid).toEqual(expect.any(String));
    expect(JSON.stringify(teacher)).not.toContain(password);

    const member = (await adminDb.doc(`${paths.members(sid)}/${teacher.uid}`).get()).data();
    expect(member).toMatchObject({ uid: teacher.uid, role: 'teacher', teacherId });

    const t = await signIn(syntheticEmail('SCC024', sid), password);
    expect(t.uid).toBe(teacher.uid);
    expect(await t.claims()).toEqual({ sid, role: 'teacher', tid: teacherId });
  });

  it('stores a known title and rejects an unknown one', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC025'), name: 'K. Perera', title: 'Ven.' } });
    const stored = (await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data()!;
    expect(stored).toMatchObject({ title: 'Ven.', name: 'K. Perera' });
    expect((await adminAuth.getUser(stored.uid as string)).displayName).toBe('Ven. K. Perera');
    const { teacherId: untitled } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC026'), title: '' } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${untitled}`).get()).data()).not.toHaveProperty('title');
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC027'), title: 'King' } }), 'invalid-argument', 'invalid');
  });

  it('refuses a caller who is not admin of the school', async () => {
    const { sid } = await adminWithSchool();
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC001') }), 'permission-denied', 'not-allowed');
    const stranger = await signUp();
    await expectFnError(stranger.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC001') }), 'permission-denied', 'not-allowed');
  });

  it('refuses a super admin who is not admin of the school', async () => {
    const { sid } = await adminWithSchool();
    const sup = await signUp();
    await makeSuper(sup);
    await expectFnError(sup.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC002') }), 'permission-denied', 'not-allowed');
  });

  it('rejects a bad staff ID format', async () => {
    const { admin, sid } = await adminWithSchool();
    for (const staffId of ['ABC001', 'SCC1', 'scc001', 'SCC0011']) {
      await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: teacherInput(staffId) }), 'invalid-argument', 'invalid');
    }
  });

  it('rejects a duplicate staff ID', async () => {
    const { admin, sid } = await adminWithSchool();
    await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC005') });
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC005') }), 'already-exists', 'invalid');
    const dupes = await adminDb.collection(paths.teachers(sid)).where('staffId', '==', 'SCC005').get();
    expect(dupes.size).toBe(1);
  });

  it('is refused for a disabled school', async () => {
    const { admin, sid } = await adminWithSchool();
    const sup = await signUp();
    await makeSuper(sup);
    await sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' });
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC010') }), 'permission-denied', 'not-allowed');
  });
});

describe('resetTeacherPassword', () => {
  it('issues a new password and the old one stops working', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId, password: oldPw } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC030') });
    const email = syntheticEmail('SCC030', sid);
    await signIn(email, oldPw);

    const { password } = await admin.call('resetTeacherPassword', { schoolId: sid, teacherId });
    expect(password).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    if (password !== oldPw) await expect(signIn(email, oldPw)).rejects.toMatchObject({ code: expect.stringMatching(/wrong-password|invalid-credential/) });
    const t = await signIn(email, password);
    expect(await t.claims()).toEqual({ sid, role: 'teacher', tid: teacherId });
  });

  it('refuses a non-admin and an unknown teacher', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC031') });
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('resetTeacherPassword', { schoolId: sid, teacherId }), 'permission-denied', 'not-allowed');
    await expectFnError(admin.call('resetTeacherPassword', { schoolId: sid, teacherId: 'nope' }), 'not-found', 'invalid');
  });
});
