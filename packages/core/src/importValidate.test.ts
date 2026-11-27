// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { IMPORT_CELL_MAX, type ImportRow, type SubjectColumn, type TeacherColumn } from './importSheet';
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
  it('needs an English or a Sinhala name', () => {
    expect(errs(run([sub(5, {})], []))).toEqual([{ sheet: 'subjects', row: 5, column: 'nameEn', code: 'nameMissing' }]);
    const p = run([sub(2, { nameSi: 'දහම් පාසල' })], []);
    expect(errs(p)).toEqual([]);
    expect(p.subjects[0]).toMatchObject({ nameEn: '', nameSi: 'දහම් පාසල', short: 'දහම්' });
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

describe('validateImport subject trimming', () => {
  it('trims names and treats a whitespace-only English name as missing', () => {
    const p = run([sub(2, { nameEn: '  Drama ', nameSi: ' නාට්‍ය  ' }), sub(3, { nameEn: '   ', nameSi: '  ', short: 'X' })], []);
    expect(errs(p)).toEqual([{ sheet: 'subjects', row: 3, column: 'nameEn', code: 'nameMissing' }]);
    expect(p.subjects[0]).toMatchObject({ nameEn: 'Drama', nameSi: 'නාට්‍ය', short: 'Dra' });
    expect(p.subjects[1]).not.toHaveProperty('nameSi');
  });
});

describe('validateImport subject lengths', () => {
  it('subject names over the name max are tooLong', () => {
    const p = run([sub(2, { nameEn: 'x'.repeat(201), nameSi: 'y'.repeat(201), short: 'X' })], []);
    expect(errs(p)).toEqual([
      { sheet: 'subjects', row: 2, column: 'nameEn', code: 'tooLong' },
      { sheet: 'subjects', row: 2, column: 'nameSi', code: 'tooLong' },
    ]);
    expect(p.errors[0]?.params).toEqual({ max: 200 });
  });
});

describe('validateImport short reservation', () => {
  it('generated short never collides with a later explicit short', () => {
    const p = run([sub(2, { nameEn: 'Drama' }), sub(3, { nameEn: 'Dance', short: 'Dra' })], []);
    expect(p.errors).toEqual([]);
    expect(p.subjects.map((x) => x.short)).toEqual(['Dram', 'Dra']);
  });
});

describe('validateImport teacher errors', () => {
  const one = (cells: Partial<Record<TeacherColumn, string>>, c = ctx) => run([], [tch(7, cells)], c);
  const only = (cells: Partial<Record<TeacherColumn, string>>) => errs(one(cells));
  const e = (column: TeacherColumn, code: string) => ({ sheet: 'teachers', row: 7, column, code });

  it('requires a name', () => {
    expect(only({ isPrimary: 'y' })).toEqual([e('name', 'nameMissing')]);
  });
  it('accepts a Sinhala-only or two-language name', () => {
    const { name: _drop, ...noEn } = okTeacher;
    const si = one({ ...noEn, nameSi: ' ජී. ජයසේකර ' });
    expect(errs(si)).toEqual([]);
    expect(si.teachers[0]?.teacher).toMatchObject({ name: '', nameSi: 'ජී. ජයසේකර' });
    expect(one({ ...okTeacher, nameSi: 'එන්. පෙරේරා' }).teachers[0]?.teacher).toMatchObject({ name: okTeacher.name, nameSi: 'එන්. පෙරේරා' });
    expect(one(okTeacher).teachers[0]?.teacher).not.toHaveProperty('nameSi');
  });
  it('name tooLong', () => {
    expect(only({ ...okTeacher, name: 'x'.repeat(201) })).toEqual([e('name', 'tooLong')]);
  });
  it('staffIdFormat with example', () => {
    const p = one({ ...okTeacher, staffId: 'ABC1' });
    expect(errs(p)).toEqual([e('staffId', 'staffIdFormat')]);
    expect(p.errors[0]?.params).toEqual({ example: 'SCC024' });
  });
  it('an auto staff ID past 999 gets staffIdFormat', () => {
    const p = one(okTeacher, { ...ctx, staffIds: ['SCC999'] });
    expect(p.teachers[0]?.teacher.staffId).toBe('SCC1000');
    expect(errs(p)).toEqual([e('staffId', 'staffIdFormat')]);
    expect(p.errors[0]?.params).toEqual({ example: 'SCC024' });
  });
  it('trims names and treats whitespace-only as missing', () => {
    expect(only({ ...okTeacher, name: '   ' })).toEqual([e('name', 'nameMissing')]);
    expect(one({ ...okTeacher, name: '  A B  ' }).teachers[0]?.teacher.name).toBe('A B');
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
  it('accepts a teacher with no subjects or grades', () => {
    const p = one({ name: 'A' });
    expect(p.errors).toEqual([]);
    expect(p.teachers[0]?.teacher).toMatchObject({ grades: [], isPrimary: false });
    expect(p.teachers[0]?.subjectRefs).toEqual([]);
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
  it('reads optional min per week column', () => {
    expect(one(okTeacher).teachers[0]?.teacher).not.toHaveProperty('minPerWeek');
    expect(one({ ...okTeacher, minPerWeek: '' }).teachers[0]?.teacher).not.toHaveProperty('minPerWeek');
    expect(one({ ...okTeacher, minPerWeek: '20' }).teachers[0]?.teacher.minPerWeek).toBe(20);
    expect(one({ ...okTeacher, minPerWeek: '0' }).teachers[0]?.teacher.minPerWeek).toBe(0);
    expect(one({ ...okTeacher, maxPerDay: '2', minPerWeek: '10' }).teachers[0]?.teacher.minPerWeek).toBe(10);
    for (const m of ['x', '2.5', '-1', '36']) expect(only({ ...okTeacher, minPerWeek: m })).toEqual([e('minPerWeek', 'minPerWeek')]);
    expect(only({ ...okTeacher, maxPerDay: '2', minPerWeek: '11' })).toEqual([e('minPerWeek', 'minPerWeek')]);
  });
  it('primaryValue and accepted spellings', () => {
    expect(only({ ...okTeacher, isPrimary: 'maybe' })).toEqual([e('isPrimary', 'primaryValue')]);
    for (const v of ['yes', 'Y', 'TRUE', 'ඔව්']) expect(one({ ...okTeacher, isPrimary: v }).teachers[0]?.teacher.isPrimary).toBe(true);
    for (const v of ['no', 'n', 'false', 'නැත']) {
      expect(one({ name: 'A', grades: '6', subjects: 'math', isPrimary: v }).teachers[0]?.teacher.isPrimary).toBe(false);
    }
  });
  it('any cell over the server limit is tooLong', () => {
    const long = 'a'.repeat(IMPORT_CELL_MAX + 1);
    const p = one({ ...okTeacher, email: `${long}@b.lk`, title: long });
    expect(errs(p)).toEqual([e('title', 'tooLong'), e('email', 'tooLong')]);
    expect(p.errors[0]?.params).toEqual({ max: IMPORT_CELL_MAX });
  });
  it('a grades cell Excel turned into a date gets excelDate, not gradeFormat', () => {
    const p = run([], [{ row: 7, cells: { ...okTeacher, grades: '2026-06-09' }, cellTypes: { grades: 'date' } }]);
    expect(errs(p)).toEqual([e('grades', 'excelDate')]);
  });
  it('a date in any other column gets excelDate', () => {
    const p = run([], [{ row: 7, cells: { ...okTeacher, maxPerDay: '2026-01-05' }, cellTypes: { maxPerDay: 'date' } }]);
    expect(errs(p)).toEqual([e('maxPerDay', 'excelDate')]);
  });
  it('a phone that arrived as a number gets excelNumber', () => {
    const p = run([], [{ row: 7, cells: { ...okTeacher, phone: '771234567' }, cellTypes: { phone: 'number' } }]);
    expect(errs(p)).toEqual([e('phone', 'excelNumber')]);
  });
  it('numeric grades and maxPerDay are fine', () => {
    const p = run([], [{ row: 7, cells: { ...okTeacher, grades: '6', maxPerDay: '5' }, cellTypes: { grades: 'number', maxPerDay: 'number' } }]);
    expect(p.errors).toEqual([]);
  });
  it('subjects split on semicolons when present, so names can contain commas', () => {
    const p = run(
      [sub(2, { nameEn: 'Art, Craft', short: 'AC' })],
      [tch(7, { name: 'A', grades: '6', subjects: 'Art, Craft; math' }), tch(8, { name: 'B', grades: '6', subjects: 'AC, math' })],
    );
    expect(p.errors).toEqual([]);
    expect(p.teachers.map((t) => t.subjectRefs)).toEqual([
      [{ newIndex: 0 }, { existingId: 's1' }],
      [{ newIndex: 0 }, { existingId: 's1' }],
    ]);
  });
  it('collects errors across rows with original row numbers', () => {
    const p = run([], [tch(4, { grades: '6', isPrimary: 'y' }), tch(9, { grades: '7' })]);
    expect(errs(p)).toEqual([
      { sheet: 'teachers', row: 4, column: 'name', code: 'nameMissing' },
      { sheet: 'teachers', row: 9, column: 'name', code: 'nameMissing' },
    ]);
  });
});
