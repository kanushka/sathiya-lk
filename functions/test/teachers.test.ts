// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminWithSchool, expectFnError, makeSuper, signUp, teacherInput } from './helpers';

describe('createTeacher', () => {
  it('creates only the teacher record, no auth user and no member', async () => {
    const { admin, sid } = await adminWithSchool();
    const users = (await adminAuth.listUsers()).users.length;
    const res = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC024') });
    expect(res).toEqual({ teacherId: expect.any(String) });
    const { teacherId } = res;

    const teacher = (await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data()!;
    expect(teacher).toMatchObject({ staffId: 'SCC024', name: 'Mrs. K. Perera', grades: [6, 7], maxPerDay: 6 });
    expect(teacher.uid).toBeUndefined();
    expect((await adminDb.collection(paths.members(sid)).get()).size).toBe(1);
    expect((await adminAuth.listUsers()).users.length).toBe(users);
  });

  it('stores a known title and rejects an unknown one', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC025'), name: 'K. Perera', title: 'Ven.' } });
    const stored = (await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data()!;
    expect(stored).toMatchObject({ title: 'Ven.', name: 'K. Perera' });
    const { teacherId: untitled } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC026'), title: '' as never } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${untitled}`).get()).data()).not.toHaveProperty('title');
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC027'), title: 'King' as never } }), 'invalid-argument', 'invalid');
  });

  it('stores minPerWeek, accepts it absent, and rejects it above maxPerDay x 5', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC040'), minPerWeek: 20 } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data()).toMatchObject({ maxPerDay: 6, minPerWeek: 20 });
    const { teacherId: bare } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC041') });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${bare}`).get()).data()).not.toHaveProperty('minPerWeek');
    const { teacherId: edge } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC042'), minPerWeek: 30 } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${edge}`).get()).data()?.minPerWeek).toBe(30);
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC043'), minPerWeek: 31 } }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC044'), minPerWeek: -1 } }), 'invalid-argument', 'invalid');
  });

  it('takes the name in English, Sinhala or both, but not neither', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC030'), name: '', nameSi: 'ජී. ජයසේකර', title: 'Mr' } });
    const stored = (await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data()!;
    expect(stored).toMatchObject({ name: '', nameSi: 'ජී. ජයසේකර' });
    const { teacherId: both } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC031'), name: 'N. Perera', nameSi: 'එන්. පෙරේරා' } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${both}`).get()).data()).toMatchObject({ name: 'N. Perera', nameSi: 'එන්. පෙරේරා' });
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC032'), name: ' ', nameSi: '' } }), 'invalid-argument', 'invalid');
    const { teacherId: blankSi } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC033'), name: 'N. Perera', nameSi: ' ' } });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${blankSi}`).get()).data()?.nameSi).toBeUndefined();
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
    await expectFnError(admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC010') }), 'failed-precondition', 'school-disabled');
  });
});
