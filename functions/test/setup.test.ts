// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, syntheticEmail } from '@sathiya/core';
import { C, ctx, entries as fixtureEntries, entry, G, S, T, TPL } from '@sathiya/core/fixtures';
import { describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminWithSchool, expectFnError, signIn, teacherInput } from './helpers';
import { putEntries, seededSchool, YEAR } from './seed';

describe('deleteSetupItem', () => {
  it('refuses a subject used by entries and reports usedIn', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('e1', 0, 1, [C.c6a], [[S.pali, T.ananda]]), entry('e2', 1, 1, [C.c6a], [[S.pali, T.ananda]])]);
    const res = await admin.call('deleteSetupItem', { schoolId: sid, kind: 'subject', id: S.pali });
    // 2 entries + the 12A plan override.
    expect(res).toEqual({ deleted: false, usedIn: 3 });
    expect((await adminDb.doc(`${paths.subjects(sid)}/${S.pali}`).get()).exists).toBe(true);
  });

  it('counts entries only in the latest year (highest label)', async () => {
    const { admin, sid } = await seededSchool();
    await adminDb.doc(`${paths.years(sid)}/zz-old`).set({ label: '2026', status: 'published' });
    await putEntries(sid, [entry('old', 0, 1, [C.c6a], [[S.maths, T.fonseka]])], 'zz-old');
    await putEntries(sid, [entry('new', 0, 1, [C.c6a], [[S.pts, T.fonseka]])]);
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'teacher', id: T.fonseka })).toEqual({ deleted: false, usedIn: 1 });

    // A teacher used only in an older year can be deleted.
    await putEntries(sid, [entry('old2', 1, 1, [C.c6a], [[S.maths, T.jayawardena]])], 'zz-old');
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'teacher', id: T.jayawardena })).toEqual({ deleted: true, usedIn: 0 });
  });

  it('refuses a subject that is only in a grade plan, a group option or a class plan override', async () => {
    const { admin, sid } = await seededSchool();
    // Science: grade 6 and 12 plans.
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'subject', id: S.science })).toEqual({ deleted: false, usedIn: 2 });
    // Islam: religion group option of grades 1 and 6.
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'subject', id: S.islam })).toEqual({ deleted: false, usedIn: 2 });
  });

  it('refuses a class teacher, the default template and a template in use', async () => {
    const { admin, sid } = await seededSchool();
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'teacher', id: T.bandara })).toEqual({ deleted: false, usedIn: 1 });
    const def = await admin.call('deleteSetupItem', { schoolId: sid, kind: 'template', id: TPL.default });
    expect(def.deleted).toBe(false);
    expect(def.usedIn).toBeGreaterThanOrEqual(1);
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'template', id: TPL.primary })).toEqual({ deleted: false, usedIn: 1 });
    expect((await adminDb.doc(`${paths.templates(sid)}/${TPL.default}`).get()).exists).toBe(true);
  });

  it('deletes an unused subject, class and template', async () => {
    const { admin, sid } = await seededSchool();
    await adminDb.doc(`${paths.subjects(sid)}/s-unused`).set({ nameEn: 'Unused', short: 'U', color: '#ffffff' });
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'subject', id: 's-unused' })).toEqual({ deleted: true, usedIn: 0 });
    expect((await adminDb.doc(`${paths.subjects(sid)}/s-unused`).get()).exists).toBe(false);
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'class', id: C.c6c })).toEqual({ deleted: true, usedIn: 0 });
    // Short Friday was only used by 6C.
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'template', id: TPL.shortFriday })).toEqual({ deleted: true, usedIn: 0 });
  });

  it('deletes a teacher with its member doc and Auth user', async () => {
    const { admin, sid } = await seededSchool();
    const { teacherId, password } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC201') });
    const email = syntheticEmail('SCC201', sid);
    await signIn(email, password);
    const { uid } = (await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data()!;

    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'teacher', id: teacherId })).toEqual({ deleted: true, usedIn: 0 });
    expect((await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).exists).toBe(false);
    expect((await adminDb.doc(`${paths.members(sid)}/${uid}`).get()).exists).toBe(false);
    await expect(adminAuth.getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    // The staff ID is free again.
    await expect(admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC201') })).resolves.toBeTruthy();
  });

  it('refuses a grade whose classes are used by entries in any year', async () => {
    const { admin, sid } = await seededSchool();
    await adminDb.doc(`${paths.years(sid)}/zz-old`).set({ label: '2026', status: 'published' });
    await putEntries(sid, [entry('old', 0, 1, [C.c6a], [[S.maths, T.fonseka]])], 'zz-old');
    await putEntries(sid, [entry('new', 0, 1, [C.c6b], [[S.maths, T.fonseka]]), entry('new2', 1, 1, [C.c6b], [[S.maths, T.fonseka]])]);
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'grade', id: G.g6 })).toEqual({ deleted: false, usedIn: 3 });
    expect((await adminDb.doc(`${paths.grades(sid)}/${G.g6}`).get()).exists).toBe(true);
    expect((await adminDb.doc(`${paths.classes(sid)}/${C.c6a}`).get()).exists).toBe(true);
  });

  it('deletes an unused grade together with its classes', async () => {
    const { admin, sid } = await seededSchool();
    await adminDb.doc(`${paths.grades(sid)}/g-new`).set({ number: 9, plan: [] });
    await adminDb.doc(`${paths.classes(sid)}/c-9a`).set({ gradeId: 'g-new', name: '9A', templateId: 'x' });
    await adminDb.doc(`${paths.classes(sid)}/c-9b`).set({ gradeId: 'g-new', name: '9B', templateId: 'x' });
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'grade', id: 'g-new' })).toEqual({ deleted: true, usedIn: 0 });
    expect((await adminDb.doc(`${paths.grades(sid)}/g-new`).get()).exists).toBe(false);
    expect((await adminDb.collection(paths.classes(sid)).where('gradeId', '==', 'g-new').get()).size).toBe(0);
    expect((await adminDb.doc(`${paths.classes(sid)}/${C.c6a}`).get()).exists).toBe(true);
  });

  it('only lets an admin of the school delete a grade', async () => {
    const { sid } = await seededSchool();
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('deleteSetupItem', { schoolId: sid, kind: 'grade', id: G.g6 }), 'permission-denied', 'not-allowed');
    expect((await adminDb.doc(`${paths.grades(sid)}/${G.g6}`).get()).exists).toBe(true);
  });

  it('refuses an unknown item and a non-admin', async () => {
    const { admin, sid } = await seededSchool();
    await expectFnError(admin.call('deleteSetupItem', { schoolId: sid, kind: 'subject', id: 'nope' }), 'not-found', 'invalid');
    await expectFnError(admin.call('deleteSetupItem', { schoolId: sid, kind: 'bogus' as never, id: G.g1 }), 'invalid-argument', 'invalid');
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('deleteSetupItem', { schoolId: sid, kind: 'subject', id: S.pali }), 'permission-denied', 'not-allowed');
  });
});

describe('publishYear', () => {
  it('writes class and teacher snapshots and activates the year', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, fixtureEntries);
    const res = await admin.call('publishYear', { schoolId: sid, yearId: YEAR });
    expect(res).toEqual({ classes: ctx.classes.length, teachers: ctx.teachers.length });

    const classes = await adminDb.collection(paths.publishedClasses(sid, YEAR)).get();
    const teachers = await adminDb.collection(paths.publishedTeachers(sid, YEAR)).get();
    expect(classes.size + teachers.size).toBe(ctx.classes.length + ctx.teachers.length);
    const six = (await adminDb.doc(paths.publishedClass(sid, YEAR, C.c6b)).get()).data()!;
    expect(six).toMatchObject({ classId: C.c6b, className: '6B', gradeNumber: 6, yearLabel: '2027', classTeacher: 'Mrs. N. Perera' });
    expect(six.cells).toHaveLength(36);

    const year = (await adminDb.doc(`${paths.years(sid)}/${YEAR}`).get()).data()!;
    expect(year).toMatchObject({ status: 'published', publishedAt: expect.any(Number) });
    expect((await adminDb.doc(paths.school(sid)).get()).data()!.activeYearId).toBe(YEAR);
  });

  it('removes stale snapshots on re-publish', async () => {
    const { admin, sid } = await seededSchool();
    await admin.call('publishYear', { schoolId: sid, yearId: YEAR });
    expect(await admin.call('deleteSetupItem', { schoolId: sid, kind: 'class', id: C.c6c })).toMatchObject({ deleted: true });
    await adminDb.doc(paths.publishedTeacher(sid, YEAR, 't-gone')).set({ teacherId: 't-gone' });

    expect(await admin.call('publishYear', { schoolId: sid, yearId: YEAR })).toEqual({ classes: ctx.classes.length - 1, teachers: ctx.teachers.length });
    expect((await adminDb.doc(paths.publishedClass(sid, YEAR, C.c6c)).get()).exists).toBe(false);
    expect((await adminDb.doc(paths.publishedTeacher(sid, YEAR, 't-gone')).get()).exists).toBe(false);
    expect((await adminDb.collection(paths.publishedClasses(sid, YEAR)).get()).size).toBe(ctx.classes.length - 1);
  });

  it('refuses an unknown year and a non-admin', async () => {
    const { admin, sid } = await seededSchool();
    await expectFnError(admin.call('publishYear', { schoolId: sid, yearId: 'nope' }), 'invalid-argument', 'invalid');
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('publishYear', { schoolId: sid, yearId: YEAR }), 'permission-denied', 'not-allowed');
    expect((await adminDb.doc(`${paths.years(sid)}/${YEAR}`).get()).data()!.status).toBe('draft');
  });
});
