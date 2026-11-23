// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { importFingerprint, paths, subjectsFingerprint, syntheticEmail, type ImportRow, type SubjectColumn, type TeacherColumn } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminAuth, adminDb, adminWithSchool, expectFnError, signIn, signUp, teacherInput } from './helpers';

const sub = (row: number, cells: Partial<Record<SubjectColumn, string>>): ImportRow<SubjectColumn> => ({ row, cells });
const tch = (row: number, cells: Partial<Record<TeacherColumn, string>>): ImportRow<TeacherColumn> => ({ row, cells });
const NONE = subjectsFingerprint([]);

describe('importSetup', () => {
  it('imports subjects and teachers with resolved subject ids', async () => {
    const { admin, sid } = await adminWithSchool();
    const res = await admin.call('importSetup', {
      schoolId: sid,
      subjectsVersion: NONE,
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
      subjectsVersion: NONE,
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
        subjectsVersion: NONE,
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
      .call('importSetup', { schoolId: sid, subjectsVersion: NONE, subjects: [], teachers: [tch(2, { staffId: 'SCC040', name: 'Dup', grades: '6', subjects: 's-maths' })] })
      .then(
        () => null,
        (e: { details?: { errors?: unknown[] } }) => e,
      );
    expect(err?.details?.errors).toContainEqual(expect.objectContaining({ code: 'staffIdTaken', row: 2 }));
  });

  it('refuses when subjects changed since the client checked the file', async () => {
    const { admin, sid } = await adminWithSchool();
    const art = { id: 's-new', nameEn: 'Art', short: 'Art' };
    await adminDb.doc(`${paths.subjects(sid)}/s-new`).set({ nameEn: 'Art', short: 'Art', color: '#000000' });
    const body = { schoolId: sid, subjects: [], teachers: [tch(2, { name: 'A', grades: '6', subjects: 'Art' })] };
    for (const subjectsVersion of [NONE, subjectsFingerprint([art, { id: 's-gone', nameEn: 'Gone', short: 'Gon' }])]) {
      const err = await admin.call('importSetup', { ...body, subjectsVersion }).then(
        () => null,
        (e: { code?: string; details?: { code?: string; errors?: unknown[] } }) => e,
      );
      expect(err?.code).toBe('functions/invalid-argument');
      expect(err?.details?.code).toBe('invalid');
      expect(err?.details?.errors).toEqual([{ sheet: 'file', row: null, column: null, code: 'subjectsChanged' }]);
    }
    expect((await adminDb.collection(paths.teachers(sid)).get()).size).toBe(0);
    const res = await admin.call('importSetup', { ...body, subjectsVersion: subjectsFingerprint([art]) });
    expect(res.teachers).toHaveLength(1);
  });

  it('refuses when a subject was renamed since the client checked the file', async () => {
    const { admin, sid } = await adminWithSchool();
    const ref = adminDb.doc(`${paths.subjects(sid)}/s-art`);
    await ref.set({ nameEn: 'Art', short: 'Art', color: '#000000' });
    const subjectsVersion = subjectsFingerprint([{ id: 's-art', nameEn: 'Art', short: 'Art' }]);
    await ref.update({ nameEn: 'Drawing', short: 'Drw' });
    const err = await admin
      .call('importSetup', { schoolId: sid, subjectsVersion, subjects: [], teachers: [tch(2, { name: 'A', grades: '6', subjects: 'Art' })] })
      .then(
        () => null,
        (e: { details?: { errors?: unknown[] } }) => e,
      );
    expect(err?.details?.errors).toEqual([{ sheet: 'file', row: null, column: null, code: 'subjectsChanged' }]);
    expect((await adminDb.collection(paths.teachers(sid)).get()).size).toBe(0);
  });

  it('refuses the same file again within 24 hours', async () => {
    const { admin, sid } = await adminWithSchool();
    const body = { schoolId: sid, subjectsVersion: NONE, subjects: [], teachers: [tch(2, { name: 'A', grades: '6', isPrimary: 'yes' }), tch(3, { name: 'B', grades: '6', isPrimary: 'yes' })] };
    expect((await admin.call('importSetup', body)).teachers).toHaveLength(2);
    const err = await admin.call('importSetup', body).then(
      () => null,
      (e: { code?: string; details?: { code?: string; errors?: unknown[] } }) => e,
    );
    expect(err?.code).toBe('functions/invalid-argument');
    expect(err?.details?.code).toBe('invalid');
    expect(err?.details?.errors).toEqual([{ sheet: 'file', row: null, column: null, code: 'alreadyImported' }]);
    expect((await adminDb.collection(paths.teachers(sid)).get()).size).toBe(2);
    const markers = await adminDb.collection(paths.imports(sid)).get();
    expect(markers.docs.map((d) => d.id)).toEqual([importFingerprint(body)]);
    expect(markers.docs[0]!.data()).toMatchObject({ createdAt: expect.any(Number), subjects: 0, teachers: 2 });
  });

  it('imports the same file again once the marker is over 24 hours old', async () => {
    const { admin, sid } = await adminWithSchool();
    const body = { schoolId: sid, subjectsVersion: NONE, subjects: [], teachers: [tch(2, { name: 'A', grades: '6', isPrimary: 'yes' })] };
    const marker = adminDb.doc(`${paths.imports(sid)}/${importFingerprint(body)}`);
    const old = Date.now() - 25 * 60 * 60 * 1000;
    await marker.set({ createdAt: old, createdBy: 'someone', subjects: 0, teachers: 1 });
    expect((await admin.call('importSetup', body)).teachers).toHaveLength(1);
    expect((await marker.get()).data()!.createdAt).toBeGreaterThan(old);
  });

  it('lets the same file be retried when the first attempt created nothing', async () => {
    const { admin, sid } = await adminWithSchool();
    const auth = await adminAuth.createUser({ email: syntheticEmail('SCC045', sid), password: 'whatever123' });
    const body = { schoolId: sid, subjectsVersion: NONE, subjects: [], teachers: [tch(2, { staffId: 'SCC045', name: 'A', grades: '6', isPrimary: 'yes' })] };
    const first = await admin.call('importSetup', body);
    expect(first).toMatchObject({ teachers: [], notCreated: ['SCC045'] });
    expect((await adminDb.collection(paths.imports(sid)).get()).size).toBe(0);
    await adminAuth.deleteUser(auth.uid);
    expect((await admin.call('importSetup', body)).teachers).toHaveLength(1);
  });

  it('refuses non-admins, oversized and empty imports, unknown columns', async () => {
    const { admin, sid } = await adminWithSchool();
    const stranger = await signUp();
    await expectFnError(stranger.call('importSetup', { schoolId: sid, subjectsVersion: NONE, subjects: [sub(2, { nameEn: 'X' })], teachers: [] }), 'permission-denied', 'not-allowed');
    const many = Array.from({ length: 201 }, (_, i) => sub(i + 2, { nameEn: `S${i}` }));
    await expectFnError(admin.call('importSetup', { schoolId: sid, subjectsVersion: NONE, subjects: many, teachers: [] }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('importSetup', { schoolId: sid, subjectsVersion: NONE, subjects: [], teachers: [] }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('importSetup', { schoolId: sid, subjectsVersion: NONE, subjects: [{ row: 2, cells: { bogus: 'x' } }] as never, teachers: [] }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('importSetup', { schoolId: sid, subjectsVersion: NONE, subjects: [{ row: 1, cells: { nameEn: 'x' } }] as never, teachers: [] }), 'invalid-argument', 'invalid');
  });

  it('stops at the first account failure and reports notCreated', async () => {
    const { admin, sid } = await adminWithSchool();
    await adminAuth.createUser({ email: syntheticEmail('SCC045', sid), password: 'whatever123' });
    const ids = Array.from({ length: 8 }, (_, i) => `SCC0${45 + i}`);
    const res = await admin.call('importSetup', {
      schoolId: sid,
      subjectsVersion: NONE,
      subjects: [sub(2, { nameEn: 'Dance' })],
      teachers: ids.map((staffId, i) => tch(i + 2, { staffId, name: `T${i}`, grades: '6', subjects: 'Dance' })),
    });
    expect(res.subjectIds).toHaveLength(1);
    const created = res.teachers.map((t) => t.staffId);
    expect(res.notCreated).toContain('SCC045');
    expect([...created, ...res.notCreated].sort()).toEqual(ids);
    const docs = await adminDb.collection(paths.teachers(sid)).get();
    expect(docs.docs.map((d) => d.data().staffId as string).sort()).toEqual([...created].sort());
  });

  it('rejects malformed request shapes', async () => {
    const { admin, sid } = await adminWithSchool();
    const bad = (body: Record<string, unknown>) => expectFnError(admin.call('importSetup', { schoolId: sid, subjectsVersion: NONE, ...body } as never), 'invalid-argument', 'invalid');
    await bad({ subjects: [{ row: 2, cells: { nameEn: 5 } }], teachers: [] });
    await bad({ subjects: [{ row: 2, cells: { nameEn: 'x'.repeat(501) } }], teachers: [] });
    await bad({ subjects: [{ row: 2, cells: [] }], teachers: [] });
    await bad({ subjects: [{ row: 2, cells: null }], teachers: [] });
    await bad({ subjects: [sub(2, { nameEn: 'X' })] });
    await bad({ subjectsVersion: undefined, subjects: [sub(2, { nameEn: 'X' })], teachers: [] });
    await bad({ subjectsVersion: ['s1'], subjects: [sub(2, { nameEn: 'X' })], teachers: [] });
    await bad({ subjectsVersion: 'x'.repeat(65), subjects: [sub(2, { nameEn: 'X' })], teachers: [] });
    await bad({ subjects: [], teachers: Array.from({ length: 201 }, (_, i) => tch(i + 2, { name: `T${i}` })) });
  });
});
