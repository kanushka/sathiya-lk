// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, syntheticEmail, type ImportRow, type SubjectColumn, type TeacherColumn } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminWithSchool, expectFnError, signIn, signUp, teacherInput } from './helpers';

const sub = (row: number, cells: Partial<Record<SubjectColumn, string>>): ImportRow<SubjectColumn> => ({ row, cells });
const tch = (row: number, cells: Partial<Record<TeacherColumn, string>>): ImportRow<TeacherColumn> => ({ row, cells });

describe('importSetup', () => {
  it('imports subjects and teachers with resolved subject ids', async () => {
    const { admin, sid } = await adminWithSchool();
    const res = await admin.call('importSetup', {
      schoolId: sid,
      subjects: [sub(2, { nameEn: 'Robotics', short: 'ROB' }), sub(3, { nameEn: 'Chess', nameSi: 'චෙස්' })],
      teachers: [
        tch(2, { name: 'Nimal Silva', subjects: 'ROB', grades: '6-7' }),
        tch(3, { name: 'Kamala Perera', isPrimary: 'yes', grades: '6' }),
      ],
    });
    expect(res.subjectIds).toHaveLength(2);
    expect(res.notCreated).toEqual([]);
    expect(res.teachers).toHaveLength(2);

    const rob = (await adminDb.doc(`${paths.subjects(sid)}/${res.subjectIds[0]}`).get()).data()!;
    expect(rob).toMatchObject({ nameEn: 'Robotics', short: 'ROB' });
    expect(rob.color).toEqual(expect.any(String));
    const chess = (await adminDb.doc(`${paths.subjects(sid)}/${res.subjectIds[1]}`).get()).data()!;
    expect(chess).toMatchObject({ nameEn: 'Chess', nameSi: 'චෙස්' });

    const [t1, t2] = res.teachers;
    expect(t1!.password).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    const doc1 = (await adminDb.doc(`${paths.teachers(sid)}/${t1!.teacherId}`).get()).data()!;
    expect(doc1).toMatchObject({ staffId: t1!.staffId, name: 'Nimal Silva', subjectIds: [res.subjectIds[0]], grades: [6, 7] });
    expect(JSON.stringify(doc1)).not.toContain(t1!.password);
    const doc2 = (await adminDb.doc(`${paths.teachers(sid)}/${t2!.teacherId}`).get()).data()!;
    expect(doc2).toMatchObject({ isPrimary: true, subjectIds: [] });

    const member = (await adminDb.doc(`${paths.members(sid)}/${doc1.uid}`).get()).data();
    expect(member).toMatchObject({ uid: doc1.uid, role: 'teacher', teacherId: t1!.teacherId });
    const signed = await signIn(syntheticEmail(t1!.staffId, sid), t1!.password);
    expect(await signed.claims()).toEqual({ sid, role: 'teacher', tid: t1!.teacherId });
  });

  it('continues auto staff IDs after existing teachers', async () => {
    const { admin, sid } = await adminWithSchool();
    await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC007') });
    const res = await admin.call('importSetup', {
      schoolId: sid,
      subjects: [sub(2, { nameEn: 'Art' })],
      teachers: [tch(2, { name: 'A', grades: '6', subjects: 'Art' }), tch(3, { name: 'B', grades: '6', subjects: 'Art' })],
    });
    expect(res.teachers.map((t) => t.staffId)).toEqual(['SCC008', 'SCC009']);
  });

  it('rejects an import with errors and writes nothing', async () => {
    const { admin, sid } = await adminWithSchool();
    const err = await admin
      .call('importSetup', {
        schoolId: sid,
        subjects: [sub(2, { nameEn: 'Music' })],
        teachers: [tch(2, { name: 'X', grades: '6', subjects: 'Nope' })],
      })
      .then(
        () => null,
        (e: { code?: string; details?: { code?: string; errors?: unknown[] } }) => e,
      );
    expect(err?.code).toBe('functions/invalid-argument');
    expect(err?.details?.code).toBe('invalid');
    expect(err?.details?.errors).toContainEqual(expect.objectContaining({ sheet: 'teachers', row: 2, code: 'unknownSubject' }));
    expect((await adminDb.collection(paths.subjects(sid)).where('nameEn', '==', 'Music').get()).size).toBe(0);
    expect((await adminDb.collection(paths.teachers(sid)).get()).size).toBe(0);
  });

  it('re-checks staff IDs against fresh server state', async () => {
    const { admin, sid } = await adminWithSchool();
    await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC040') });
    const err = await admin
      .call('importSetup', { schoolId: sid, subjects: [], teachers: [tch(2, { staffId: 'SCC040', name: 'Dup', grades: '6', subjects: 's-maths' })] })
      .then(
        () => null,
        (e: { details?: { errors?: unknown[] } }) => e,
      );
    expect(err?.details?.errors).toContainEqual(expect.objectContaining({ code: 'staffIdTaken', row: 2 }));
  });

  it('refuses non-admins, oversized and empty imports, unknown columns', async () => {
    const { admin, sid } = await adminWithSchool();
    const stranger = await signUp();
    await expectFnError(stranger.call('importSetup', { schoolId: sid, subjects: [sub(2, { nameEn: 'X' })], teachers: [] }), 'permission-denied', 'not-allowed');
    const many = Array.from({ length: 201 }, (_, i) => sub(i + 2, { nameEn: `S${i}` }));
    await expectFnError(admin.call('importSetup', { schoolId: sid, subjects: many, teachers: [] }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('importSetup', { schoolId: sid, subjects: [], teachers: [] }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('importSetup', { schoolId: sid, subjects: [{ row: 2, cells: { bogus: 'x' } }] as never, teachers: [] }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('importSetup', { schoolId: sid, subjects: [{ row: 1, cells: { nameEn: 'x' } }] as never, teachers: [] }), 'invalid-argument', 'invalid');
  });

  it('stops at the first account failure and reports notCreated', async () => {
    const { admin, sid } = await adminWithSchool();
    await adminAuth.createUser({ email: syntheticEmail('SCC045', sid), password: 'whatever123' });
    const res = await admin.call('importSetup', {
      schoolId: sid,
      subjects: [sub(2, { nameEn: 'Dance' })],
      teachers: ['SCC044', 'SCC045', 'SCC046'].map((staffId, i) => tch(i + 2, { staffId, name: `T${i}`, grades: '6', subjects: 'Dance' })),
    });
    expect(res.subjectIds).toHaveLength(1);
    expect(res.teachers.map((t) => t.staffId)).toContain('SCC044');
    expect(res.notCreated).toContain('SCC045');
    expect(res.teachers.map((t) => t.staffId)).not.toContain('SCC045');
    expect((await adminDb.collection(paths.teachers(sid)).where('staffId', '==', 'SCC045').get()).size).toBe(0);
  });
});
