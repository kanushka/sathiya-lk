// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import type { ImportRow, SubjectColumn, TeacherColumn } from './importSheet';
import { PHONE_RE, validateImport, type ImportContext } from './importValidate';
import { SUBJECT_SWATCHES } from './subjectShort';

const ctx: ImportContext = {
  staffPrefix: 'SCC',
  schoolGrades: [6, 7, 8, 9, 10, 11],
  subjects: [{ id: 's1', nameEn: 'Mathematics', nameSi: 'ගණිතය', short: 'Math' }],
  staffIds: ['SCC001', 'SCC002'],
};

const sub = (row: number, cells: Partial<Record<SubjectColumn, string>>): ImportRow<SubjectColumn> => ({ row, cells });
const tch = (row: number, cells: Partial<Record<TeacherColumn, string>>): ImportRow<TeacherColumn> => ({ row, cells });
const okTeacher = { name: 'A B', grades: '6', isPrimary: 'yes' } as const;

const run = (subjects: ImportRow<SubjectColumn>[], teachers: ImportRow<TeacherColumn>[], c = ctx) =>
  validateImport({ subjects, teachers }, c);

const errs = (p: ReturnType<typeof run>) => p.errors.map(({ sheet, row, column, code }) => ({ sheet, row, column, code }));

describe('validateImport happy path', () => {
  it('builds subjects and teachers', () => {
    const p = run(
      [sub(2, { nameEn: 'Drama' })],
      [tch(2, { name: 'K. Perera', title: 'mrs.', subjects: 'math, ගණිතය, drama', grades: '6-8, 11', maxPerDay: '' })],
    );
    expect(p.errors).toEqual([]);
    expect(p.subjects).toEqual([{ row: 2, nameEn: 'Drama', short: 'Dra', color: SUBJECT_SWATCHES[1] }]);
    expect(p.teachers).toHaveLength(1);
    expect(p.teachers[0]).toEqual({
      row: 2,
      teacher: { staffId: 'SCC003', name: 'K. Perera', title: 'Mrs', isPrimary: false, grades: [6, 7, 8, 11], maxPerDay: 7 },
      subjectRefs: [{ existingId: 's1' }, { newIndex: 0 }],
    });
  });

  it('maps title variants', () => {
    const p = run([], [tch(2, { ...okTeacher, title: 'ven' })]);
    expect(p.teachers[0]?.teacher.title).toBe('Ven.');
  });

  it('lowercases email and keeps phone', () => {
    const p = run([], [tch(2, { ...okTeacher, email: 'A@B.lk', phone: '+94 77 123 4567' })]);
    expect(p.teachers[0]?.teacher).toMatchObject({ email: 'a@b.lk', phone: '+94 77 123 4567' });
  });

  it('resolves in-file subject by generated short', () => {
    const p = run([sub(2, { nameEn: 'Western Music' })], [tch(2, { name: 'A', grades: '6', subjects: 'WMus' })]);
    expect(p.errors).toEqual([]);
    expect(p.teachers[0]?.subjectRefs).toEqual([{ newIndex: 0 }]);
  });

  it('fills staff IDs around explicit ones', () => {
    const p = run([], [tch(2, okTeacher), tch(3, okTeacher), tch(4, { ...okTeacher, staffId: 'scc004' })]);
    expect(p.errors).toEqual([]);
    expect(p.teachers.map((t) => t.teacher.staffId)).toEqual(['SCC003', 'SCC005', 'SCC004']);
  });

  it('primary teacher with no subjects is fine', () => {
    const p = run([], [tch(2, okTeacher)]);
    expect(p.errors).toEqual([]);
    expect(p.teachers[0]?.subjectRefs).toEqual([]);
    expect(p.teachers[0]?.teacher.isPrimary).toBe(true);
  });
});

describe('validateImport subject errors', () => {
  it('required nameEn', () => {
    expect(errs(run([sub(5, {})], []))).toEqual([{ sheet: 'subjects', row: 5, column: 'nameEn', code: 'required' }]);
  });
  it('nameTaken for en and si (case/space-insensitive)', () => {
    const p = run([sub(2, { nameEn: 'MATHEMATICS', nameSi: 'ගණිතය', short: 'X1' })], []);
    expect(errs(p)).toEqual([
      { sheet: 'subjects', row: 2, column: 'nameEn', code: 'nameTaken' },
      { sheet: 'subjects', row: 2, column: 'nameSi', code: 'nameTaken' },
    ]);
    expect(p.errors[0]?.params).toEqual({ value: 'MATHEMATICS' });
  });
  it('nameDuplicate within file', () => {
    expect(errs(run([sub(2, { nameEn: 'Art', short: 'A1' }), sub(3, { nameEn: 'art', short: 'A2' })], []))).toEqual([
      { sheet: 'subjects', row: 3, column: 'nameEn', code: 'nameDuplicate' },
    ]);
  });
  it('shortTooLong', () => {
    expect(errs(run([sub(2, { nameEn: 'Art', short: 'abcdefghijk' })], []))).toEqual([
      { sheet: 'subjects', row: 2, column: 'short', code: 'shortTooLong' },
    ]);
  });
  it('shortTaken and shortDuplicate', () => {
    expect(errs(run([sub(2, { nameEn: 'Art', short: 'MATH' }), sub(3, { nameEn: 'Pe', short: 'p' }), sub(4, { nameEn: 'Pf', short: 'P' })], []))).toEqual([
      { sheet: 'subjects', row: 2, column: 'short', code: 'shortTaken' },
      { sheet: 'subjects', row: 4, column: 'short', code: 'shortDuplicate' },
    ]);
  });
  it('blank short avoids existing and earlier shorts', () => {
    const p = run([sub(2, { nameEn: 'Maths' }), sub(3, { nameEn: 'Maths 2' })], []);
    expect(p.subjects.map((s) => s.short)).toEqual(['Math2', 'Mat']);
  });
});

describe('validateImport teacher errors', () => {
  const one = (cells: Partial<Record<TeacherColumn, string>>, c = ctx) => run([], [tch(7, cells)], c);
  const only = (cells: Partial<Record<TeacherColumn, string>>) => errs(one(cells));
  const e = (column: TeacherColumn, code: string) => ({ sheet: 'teachers', row: 7, column, code });

  it('required name and gradesRequired', () => {
    expect(only({ isPrimary: 'y' })).toEqual([e('name', 'required'), e('grades', 'gradesRequired')]);
  });
  it('name tooLong', () => {
    expect(only({ ...okTeacher, name: 'x'.repeat(201) })).toEqual([e('name', 'tooLong')]);
  });
  it('staffIdFormat with example', () => {
    const p = one({ ...okTeacher, staffId: 'ABC1' });
    expect(errs(p)).toEqual([e('staffId', 'staffIdFormat')]);
    expect(p.errors[0]?.params).toEqual({ example: 'SCC024' });
  });
  it('staffIdTaken and staffIdDuplicate', () => {
    const p = run([], [tch(2, { ...okTeacher, staffId: 'scc001' }), tch(3, { ...okTeacher, staffId: 'SCC009' }), tch(4, { ...okTeacher, staffId: 'scc009' })]);
    expect(errs(p)).toEqual([
      { sheet: 'teachers', row: 2, column: 'staffId', code: 'staffIdTaken' },
      { sheet: 'teachers', row: 4, column: 'staffId', code: 'staffIdDuplicate' },
    ]);
  });
  it('unknownTitle', () => {
    expect(only({ ...okTeacher, title: 'Lord' })).toEqual([e('title', 'unknownTitle')]);
  });
  it('phone and email', () => {
    expect(only({ ...okTeacher, phone: 'abc', email: 'nope' })).toEqual([e('phone', 'phone'), e('email', 'email')]);
    expect(PHONE_RE.test('077-123 4567')).toBe(true);
  });
  it('unknownSubject carries value', () => {
    const p = one({ name: 'A', grades: '6', subjects: 'maths' });
    expect(errs(p)).toEqual([e('subjects', 'unknownSubject')]);
    expect(p.errors[0]?.params).toEqual({ value: 'maths' });
  });
  it('subjectsRequired for non-primary', () => {
    expect(only({ name: 'A', grades: '6' })).toEqual([e('subjects', 'subjectsRequired')]);
  });
  it('dedupes subject refs', () => {
    const p = one({ name: 'A', grades: '6', subjects: 'math, Mathematics' });
    expect(p.teachers[0]?.subjectRefs).toEqual([{ existingId: 's1' }]);
  });
  it('gradeFormat', () => {
    for (const g of ['x', '8-6', '6-', '1.5']) expect(only({ ...okTeacher, grades: g })).toEqual([e('grades', 'gradeFormat')]);
  });
  it('gradeNotInSchool', () => {
    const p = one({ ...okTeacher, grades: '5-7' });
    expect(errs(p)).toEqual([e('grades', 'gradeNotInSchool')]);
    expect(p.errors[0]?.params).toEqual({ value: '5' });
  });
  it('maxPerDay', () => {
    for (const m of ['0', '11', 'x', '2.5']) expect(only({ ...okTeacher, maxPerDay: m })).toEqual([e('maxPerDay', 'maxPerDay')]);
    expect(one({ ...okTeacher, maxPerDay: '10' }).teachers[0]?.teacher.maxPerDay).toBe(10);
  });
  it('primaryValue and accepted spellings', () => {
    expect(only({ ...okTeacher, isPrimary: 'maybe' })).toEqual([e('isPrimary', 'primaryValue'), e('subjects', 'subjectsRequired')]);
    for (const v of ['yes', 'Y', 'TRUE', 'ඔව්']) expect(one({ ...okTeacher, isPrimary: v }).teachers[0]?.teacher.isPrimary).toBe(true);
    for (const v of ['no', 'n', 'false', 'නැත']) {
      expect(one({ name: 'A', grades: '6', subjects: 'math', isPrimary: v }).teachers[0]?.teacher.isPrimary).toBe(false);
    }
  });
  it('collects errors across rows with original row numbers', () => {
    const p = run([], [tch(4, { grades: '6', isPrimary: 'y' }), tch(9, { name: 'A', isPrimary: 'y' })]);
    expect(errs(p)).toEqual([
      { sheet: 'teachers', row: 4, column: 'name', code: 'required' },
      { sheet: 'teachers', row: 9, column: 'grades', code: 'gradesRequired' },
    ]);
  });
});
