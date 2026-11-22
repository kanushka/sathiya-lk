// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { EMAIL_RE } from './email';
import type { ImportColumn, ImportError, ImportErrorCode, ImportKind, ImportRow, ParsedSheets, SubjectColumn, TeacherColumn } from './importSheet';
import { formatStaffId, isValidStaffId, nextStaffNumber } from './staff';
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
const YES = new Set(['yes', 'y', 'true', 'ඔව්']);
const NO = new Set(['', 'no', 'n', 'false', 'නැත']);

function validateSubjects(rows: ImportRow<SubjectColumn>[], ctx: ImportContext, errors: ImportError[]): ImportSubject[] {
  const existingNames = ctx.subjects.flatMap((s) => [s.nameEn, s.nameSi]);
  const existingShorts = ctx.subjects.map((s) => s.short);
  const fileNames: string[] = [];
  const fileShorts: string[] = [];
  const out: ImportSubject[] = [];

  rows.forEach((r, i) => {
    const err = (column: SubjectColumn, code: ImportErrorCode, value?: string) =>
      errors.push({ sheet: 'subjects', row: r.row, column, code, ...(value !== undefined && { params: { value } }) });
    const nameEn = r.cells.nameEn ?? '';
    const nameSi = r.cells.nameSi ?? '';

    for (const [column, name] of [['nameEn', nameEn], ['nameSi', nameSi]] as const) {
      if (name === '') {
        if (column === 'nameEn') err('nameEn', 'required');
        continue;
      }
      if (nameTaken(name, existingNames)) err(column, 'nameTaken', name);
      else if (nameTaken(name, fileNames)) err(column, 'nameDuplicate', name);
    }
    fileNames.push(nameEn, nameSi);

    let short = r.cells.short ?? '';
    if (short !== '') {
      if (short.length > SHORT_MAX) err('short', 'shortTooLong', short);
      else if (shortTaken(short, existingShorts)) err('short', 'shortTaken', short);
      else if (shortTaken(short, fileShorts)) err('short', 'shortDuplicate', short);
    } else if (nameEn !== '') {
      short = suggestSubjectShort(nameEn, [...existingShorts, ...fileShorts]).slice(0, SHORT_MAX);
      if (short === '') err('short', 'required');
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
    const c = r.cells;
    const err = (column: ImportColumn, code: ImportErrorCode, params?: Record<string, string | number>) =>
      errors.push({ sheet: 'teachers' as ImportKind, row: r.row, column, code, ...(params && { params }) });

    let staffId = explicit[i]!;
    if (staffId !== '') {
      if (!isValidStaffId(prefix, staffId)) err('staffId', 'staffIdFormat', { example: formatStaffId(prefix, 24) });
      else if (ctx.staffIds.includes(staffId)) err('staffId', 'staffIdTaken', { value: staffId });
      else if (seenExplicit.has(staffId)) err('staffId', 'staffIdDuplicate', { value: staffId });
      seenExplicit.add(staffId);
    } else {
      while (used.has(formatStaffId(prefix, nextNo))) nextNo++;
      staffId = formatStaffId(prefix, nextNo);
      used.add(staffId);
    }

    let title: Teacher['title'];
    if (c.title) {
      title = TEACHER_TITLES.find((t) => titleKey(t) === titleKey(c.title!));
      if (!title) err('title', 'unknownTitle', { value: c.title });
    }

    const name = c.name ?? '';
    if (name === '') err('name', 'required');
    else if (name.length > NAME_MAX) err('name', 'tooLong', { max: NAME_MAX });

    const phone = c.phone;
    if (phone && !PHONE_RE.test(phone)) err('phone', 'phone', { value: phone });
    const email = c.email?.toLowerCase();
    if (email && !EMAIL_RE.test(email)) err('email', 'email', { value: c.email! });

    let grades: number[] = [];
    const gradeText = c.grades ?? '';
    const parsed = parseGrades(gradeText);
    if (parsed === null) err('grades', 'gradeFormat', { value: gradeText });
    else if (parsed.length === 0) err('grades', 'gradesRequired');
    else {
      grades = parsed;
      const bad = parsed.filter((g) => !ctx.schoolGrades.includes(g));
      if (bad.length > 0) err('grades', 'gradeNotInSchool', { value: bad.join(', ') });
    }

    let maxPerDay = DEFAULT_MAX_PER_DAY;
    if (c.maxPerDay) {
      const n = /^\d+$/.test(c.maxPerDay) ? Number(c.maxPerDay) : NaN;
      if (n >= 1 && n <= 10) maxPerDay = n;
      else err('maxPerDay', 'maxPerDay', { value: c.maxPerDay });
    }

    const flag = key(c.isPrimary ?? '');
    let isPrimary = false;
    if (YES.has(flag)) isPrimary = true;
    else if (!NO.has(flag)) err('isPrimary', 'primaryValue', { value: c.isPrimary! });

    const subjectRefs: SubjectRef[] = [];
    if (!isPrimary) {
      const tokens = (c.subjects ?? '').split(',').map((t) => t.trim()).filter((t) => t !== '');
      if (tokens.length === 0) err('subjects', 'subjectsRequired');
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
        ...(title && { title }),
        isPrimary,
        grades,
        maxPerDay,
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
