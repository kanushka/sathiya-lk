// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { EMAIL_RE } from './email';
import {
  IMPORT_CELL_MAX,
  IMPORT_COLUMNS,
  type ImportColumn,
  type ImportError,
  type ImportErrorCode,
  type ImportKind,
  type ImportRow,
  type ParsedSheets,
  type SubjectColumn,
  type TeacherColumn,
} from './importSheet';
import { formatStaffId, isValidStaffId, nextStaffNumber } from './staff';
import { defaultPrimaryGrades } from './staffing';
import { SHORT_MAX, SUBJECT_SWATCHES, nameTaken, shortTaken, suggestSubjectShort } from './subjectShort';
import { TEACHER_TITLES, type Subject, type Teacher } from './types';

export const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;

const DEFAULT_MAX_PER_DAY = 7;
const NAME_MAX = 200;

export interface ImportContext {
  staffPrefix: string;
  schoolGrades: number[];
  subjects: Pick<Subject, 'id' | 'nameEn' | 'nameSi' | 'short'>[];
  staffIds: string[];
}

export interface ImportSubject {
  row: number;
  nameEn: string;
  nameSi?: string;
  short: string;
  color: string;
}

export type SubjectRef = { existingId: string } | { newIndex: number };

export interface ImportTeacher {
  row: number;
  teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt' | 'subjectIds'>;
  subjectRefs: SubjectRef[];
}

export interface ImportPlan {
  subjects: ImportSubject[];
  teachers: ImportTeacher[];
  errors: ImportError[];
}

const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const titleKey = (s: string) => key(s).replace(/\.$/, '');
const splitList = (text: string) =>
  text.split(text.includes(';') ? ';' : ',').map((t) => t.trim()).filter((t) => t !== '');

// Columns that are reported here are skipped by the per-column checks.
function cellErrors<C extends ImportColumn>(
  r: ImportRow<C>,
  sheet: ImportKind,
  ownMax: readonly C[],
  errors: ImportError[],
): Set<C> {
  const bad = new Set<C>();
  for (const def of IMPORT_COLUMNS[sheet]) {
    const column = def.key as C;
    const text = r.cells[column];
    if (text === undefined) continue;
    const type = r.cellTypes?.[column];
    let code: ImportErrorCode | null = null;
    let params: Record<string, number> | undefined;
    if (type === 'date') code = 'excelDate';
    else if (type === 'number' && column === 'phone') code = 'excelNumber';
    else if (text.length > IMPORT_CELL_MAX && !ownMax.includes(column)) {
      code = 'tooLong';
      params = { max: IMPORT_CELL_MAX };
    }
    if (code) {
      errors.push({ sheet, row: r.row, column, code, ...(params && { params }) });
      bad.add(column);
    }
  }
  return bad;
}

const YES = new Set(['yes', 'y', 'true', 'ඔව්']);
const NO = new Set(['', 'no', 'n', 'false', 'නැත']);

function validateSubjects(rows: ImportRow<SubjectColumn>[], ctx: ImportContext, errors: ImportError[]): ImportSubject[] {
  const existingNames = ctx.subjects.flatMap((s) => [s.nameEn, s.nameSi]);
  const existingShorts = ctx.subjects.map((s) => s.short);
  const fileNames: string[] = [];
  const fileShorts: string[] = [];
  const reserved = rows.map((r) => r.cells.short ?? '').filter((x) => x !== '');
  const out: ImportSubject[] = [];

  rows.forEach((r, i) => {
    const err = (column: SubjectColumn, code: ImportErrorCode, value?: string) =>
      errors.push({ sheet: 'subjects', row: r.row, column, code, ...(value !== undefined && { params: { value } }) });
    const bad = cellErrors<SubjectColumn>(r, 'subjects', ['nameEn', 'nameSi', 'short'], errors);
    const nameEn = (r.cells.nameEn ?? '').trim();
    const nameSi = (r.cells.nameSi ?? '').trim();

    for (const [column, name] of [['nameEn', nameEn], ['nameSi', nameSi]] as const) {
      if (bad.has(column)) continue;
      if (name === '') continue;
      if (name.length > NAME_MAX) errors.push({ sheet: 'subjects', row: r.row, column, code: 'tooLong', params: { max: NAME_MAX } });
      else if (nameTaken(name, existingNames)) err(column, 'nameTaken', name);
      else if (nameTaken(name, fileNames)) err(column, 'nameDuplicate', name);
    }
    if (nameEn === '' && nameSi === '' && !bad.has('nameEn') && !bad.has('nameSi')) err('nameEn', 'nameMissing');
    fileNames.push(nameEn, nameSi);

    let short = r.cells.short ?? '';
    if (short === '' && (nameEn !== '' || nameSi !== '')) {
      short = suggestSubjectShort(nameEn || nameSi, [...existingShorts, ...reserved, ...fileShorts]).slice(0, SHORT_MAX);
      if (short === '') err('short', 'required');
    } else if (short !== '' && !bad.has('short')) {
      if (short.length > SHORT_MAX) err('short', 'shortTooLong', short);
      else if (shortTaken(short, existingShorts)) err('short', 'shortTaken', short);
      else if (shortTaken(short, fileShorts)) err('short', 'shortDuplicate', short);
    }
    fileShorts.push(short);

    out.push({
      row: r.row,
      nameEn,
      ...(nameSi !== '' && { nameSi }),
      short,
      color: SUBJECT_SWATCHES[(ctx.subjects.length + i) % SUBJECT_SWATCHES.length]!,
    });
  });
  return out;
}

function parseGrades(text: string): number[] | null {
  const grades = new Set<number>();
  for (const tok of text.split(',').map((t) => t.trim()).filter((t) => t !== '')) {
    const m = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/.exec(tok);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a > b) return null;
    for (let g = a; g <= b; g++) grades.add(g);
  }
  return [...grades].sort((x, y) => x - y);
}

function validateTeachers(
  rows: ImportRow<TeacherColumn>[],
  subjects: ImportSubject[],
  ctx: ImportContext,
  errors: ImportError[],
): ImportTeacher[] {
  const prefix = ctx.staffPrefix;
  const explicit = rows.map((r) => (r.cells.staffId ?? '').toUpperCase());
  const used = new Set([...ctx.staffIds, ...explicit.filter((id) => id !== '')]);
  let nextNo = nextStaffNumber(ctx.staffIds, prefix);
  const seenExplicit = new Set<string>();
  const out: ImportTeacher[] = [];

  const findSubject = (token: string): SubjectRef | null => {
    const k = key(token);
    const hit = (s: { nameEn?: string; nameSi?: string; short: string }) =>
      [s.nameEn, s.nameSi, s.short].some((v) => v !== undefined && key(v) === k);
    const existing = ctx.subjects.find(hit);
    if (existing) return { existingId: existing.id };
    const idx = subjects.findIndex(hit);
    return idx >= 0 ? { newIndex: idx } : null;
  };

  rows.forEach((r, i) => {
    const bad = cellErrors<TeacherColumn>(r, 'teachers', ['name', 'nameSi'], errors);
    const c: Partial<Record<TeacherColumn, string>> = Object.fromEntries(Object.entries(r.cells).filter(([k]) => !bad.has(k as TeacherColumn)));
    const err = (column: ImportColumn, code: ImportErrorCode, params?: Record<string, string | number>) =>
      errors.push({ sheet: 'teachers' as ImportKind, row: r.row, column, code, ...(params && { params }) });

    let staffId = bad.has('staffId') ? '' : explicit[i]!;
    if (staffId !== '') {
      if (!isValidStaffId(prefix, staffId)) err('staffId', 'staffIdFormat', { example: formatStaffId(prefix, 24) });
      else if (ctx.staffIds.includes(staffId)) err('staffId', 'staffIdTaken', { value: staffId });
      else if (seenExplicit.has(staffId)) err('staffId', 'staffIdDuplicate', { value: staffId });
      seenExplicit.add(staffId);
    } else {
      while (used.has(formatStaffId(prefix, nextNo))) nextNo++;
      staffId = formatStaffId(prefix, nextNo);
      used.add(staffId);
      if (!isValidStaffId(prefix, staffId)) err('staffId', 'staffIdFormat', { example: formatStaffId(prefix, 24) });
    }

    let title: Teacher['title'];
    if (c.title) {
      title = TEACHER_TITLES.find((t) => titleKey(t) === titleKey(c.title!));
      if (!title) err('title', 'unknownTitle', { value: c.title });
    }

    const name = (c.name ?? '').trim();
    const nameSi = (c.nameSi ?? '').trim();
    if (name === '' && nameSi === '') {
      if (!bad.has('name') && !bad.has('nameSi')) err('name', 'nameMissing');
    }
    if (name.length > NAME_MAX) err('name', 'tooLong', { max: NAME_MAX });
    if (nameSi.length > NAME_MAX) err('nameSi', 'tooLong', { max: NAME_MAX });

    const phone = c.phone;
    if (phone && !PHONE_RE.test(phone)) err('phone', 'phone', { value: phone });
    const email = c.email?.toLowerCase();
    if (email && !EMAIL_RE.test(email)) err('email', 'email', { value: c.email! });

    let grades: number[] = [];
    const gradeText = c.grades ?? '';
    const parsed = parseGrades(gradeText);
    if (parsed === null) err('grades', 'gradeFormat', { value: gradeText });
    else {
      grades = parsed;
      const outside = parsed.filter((g) => !ctx.schoolGrades.includes(g));
      if (outside.length > 0) err('grades', 'gradeNotInSchool', { value: outside.join(', ') });
    }

    let maxPerDay = DEFAULT_MAX_PER_DAY;
    if (c.maxPerDay) {
      const n = /^\d+$/.test(c.maxPerDay) ? Number(c.maxPerDay) : NaN;
      if (n >= 1 && n <= 10) maxPerDay = n;
      else err('maxPerDay', 'maxPerDay', { value: c.maxPerDay });
    }

    let minPerWeek: number | undefined;
    if (c.minPerWeek) {
      const n = /^\d+$/.test(c.minPerWeek) ? Number(c.minPerWeek) : NaN;
      if (n >= 0 && n <= maxPerDay * 5) minPerWeek = n;
      else err('minPerWeek', 'minPerWeek', { value: c.minPerWeek, max: maxPerDay * 5 });
    }

    const flag = key(c.isPrimary ?? '');
    let isPrimary = false;
    let primaryInvalid = bad.has('isPrimary');
    if (YES.has(flag)) isPrimary = true;
    else if (!NO.has(flag)) {
      primaryInvalid = true;
      err('isPrimary', 'primaryValue', { value: c.isPrimary! });
    }
    if (isPrimary && parsed !== null && parsed.length === 0) grades = defaultPrimaryGrades(ctx.schoolGrades);

    const subjectRefs: SubjectRef[] = [];
    if (!isPrimary && !primaryInvalid) {
      const tokens = splitList(c.subjects ?? '');
      const unknown: string[] = [];
      for (const t of tokens) {
        const ref = findSubject(t);
        if (!ref) unknown.push(t);
        else if (!subjectRefs.some((x) => JSON.stringify(x) === JSON.stringify(ref))) subjectRefs.push(ref);
      }
      if (unknown.length > 0) err('subjects', 'unknownSubject', { value: unknown.join(', ') });
    }

    out.push({
      row: r.row,
      teacher: {
        staffId,
        name,
        ...(nameSi !== '' && { nameSi }),
        ...(title && { title }),
        isPrimary,
        grades,
        maxPerDay,
        ...(minPerWeek !== undefined && { minPerWeek }),
        ...(phone && { phone }),
        ...(email && { email }),
      },
      subjectRefs,
    });
  });
  return out;
}

export function validateImport(parsed: Pick<ParsedSheets, 'subjects' | 'teachers'>, ctx: ImportContext): ImportPlan {
  const errors: ImportError[] = [];
  const subjects = validateSubjects(parsed.subjects, ctx, errors);
  const teachers = validateTeachers(parsed.teachers, subjects, ctx, errors);
  return { subjects, teachers, errors };
}
