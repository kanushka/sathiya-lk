// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { formatStaffId, IMPORT_COLUMNS, IMPORT_MAX_ROWS, TEACHER_TITLES, type ImportKind, type TeacherColumn } from '@sathiya/core';
import type { i18n as I18n } from 'i18next';

// Excel turns "6-9" into a date and drops a phone's leading 0 unless the cell is formatted as text.
const TEXT_COLUMNS: ReadonlySet<TeacherColumn> = new Set(['staffId', 'phone', 'grades']);

const header = (kind: ImportKind) =>
  IMPORT_COLUMNS[kind].map((c) => `${c.en} / ${c.si}${c.required ? ' *' : ''}`);

export type TemplateSubject = { nameEn: string; nameSi?: string; short: string };

const subjectCells = (s: TemplateSubject) => [s.nameEn, s.nameSi ?? '', s.short];
const csvLine = (cells: string[]) => cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');

// The subjects template comes pre-filled with the standard subjects the school doesn't have yet.
export function templateCsv(kind: ImportKind, subjects: readonly TemplateSubject[] = []): string {
  const lines = [header(kind), ...(kind === 'subjects' ? subjects.map(subjectCells) : [])].map(csvLine);
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

const SHEET_NAME_MAX = 31;
const SHEET_NAME_BAD = /[:\\/?*[\]]/;

// Excel refuses to open a workbook whose sheet names break these rules, so fall back to English.
export function sheetName(en: string, si: string): string {
  const both = `${en} - ${si}`;
  return both.length <= SHEET_NAME_MAX && !SHEET_NAME_BAD.test(both) ? both : en;
}

export interface TemplateSheetNames {
  howTo: string;
  subjects: string;
  teachers: string;
  example: string;
}

export function templateSheetNames(i18n: Pick<I18n, 'getFixedT'>): TemplateSheetNames {
  const en = i18n.getFixedT('en', 'import');
  const si = i18n.getFixedT('si', 'import');
  const name = (k: keyof TemplateSheetNames) => sheetName(en(`templateSheets.${k}`), si(`templateSheets.${k}`));
  return { howTo: name('howTo'), subjects: name('subjects'), teachers: name('teachers'), example: name('example') };
}

type Bi = { en: string; si: string };

export interface TemplateCopy {
  instructions: { en: string[]; si: string[] };
  labels: { titles: string; grades: string; staffId: string };
  headings: { columns: string; example: string };
  columnHelp: Record<TeacherColumn, Bi>;
  exampleNames: readonly [Bi, Bi];
}

export function templateCopy(i18n: Pick<I18n, 'getFixedT'>): TemplateCopy {
  const en = i18n.getFixedT('en', 'import');
  const si = i18n.getFixedT('si', 'import');
  const both = (key: string) => `${en(key)} / ${si(key)}`;
  const pair = (key: string): Bi => ({ en: en(key), si: si(key) });
  return {
    instructions: { en: en('instructions', { returnObjects: true }) as string[], si: si('instructions', { returnObjects: true }) as string[] },
    labels: { titles: both('templateLabels.titles'), grades: both('templateLabels.grades'), staffId: both('templateLabels.staffId') },
    headings: { columns: both('templateHeadings.columns'), example: both('templateHeadings.example') },
    columnHelp: Object.fromEntries(IMPORT_COLUMNS.teachers.map((c) => [c.key, pair(`templateColumnHelp.${c.key}`)])) as TemplateCopy['columnHelp'],
    exampleNames: [pair('templateExampleNames.one'), pair('templateExampleNames.two')],
  };
}

// Palette from tailwind.config.ts: navy, surface.2, ink.muted.
const NAVY = '#14213D';
const EXAMPLE_FILL = '#F4F5F7';
const MUTED = '#5A6378';

function exampleTeachers(opts: { staffPrefix: string; grades: number[]; subjects?: readonly TemplateSubject[]; names: readonly [Bi, Bi] }) {
  const g = opts.grades;
  const runs: string[] = [];
  for (let i = 0; i < g.length; i++) {
    let j = i;
    while (j + 1 < g.length && g[j + 1] === g[j]! + 1) j++;
    runs.push(j > i ? `${g[i]}-${g[j]}` : String(g[i]));
    i = j;
  }
  const range = runs.length > 0 ? runs.join(', ') : '6';
  const all = (opts.subjects ?? []).map((s) => s.short);
  const common = all.filter((s) => s === 'Math' || s === 'Sci');
  const shorts = common.length === 2 ? common : all.slice(0, 2);
  const subjectTeacher: Partial<Record<TeacherColumn, string>> = {
    staffId: formatStaffId(opts.staffPrefix, 1),
    title: 'Mrs',
    name: opts.names[0].en,
    nameSi: opts.names[0].si,
    phone: '0771234567',
    email: 'teacher@example.com',
    subjects: shorts.length > 0 ? shorts.join(', ') : 'Math, Sci',
    grades: range,
    maxPerDay: '6',
    isPrimary: 'No',
  };
  const primaryTeacher: Partial<Record<TeacherColumn, string>> = {
    title: 'Miss',
    name: opts.names[1].en,
    nameSi: opts.names[1].si,
    grades: String(g[0] ?? 1),
    isPrimary: 'Yes',
  };
  return [subjectTeacher, primaryTeacher];
}

export async function templateXlsx(
  opts: TemplateCopy & {
    staffPrefix: string;
    grades: number[];
    sheetNames: TemplateSheetNames;
    subjects?: readonly TemplateSubject[];
  },
): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const head = (value: string) => ({ value, type: String, fontWeight: 'bold' as const, textColor: '#FFFFFF', backgroundColor: NAVY, wrap: true, alignVertical: 'center' as const });
  const text = (value: string, extra: Record<string, unknown> = {}) => ({ value, type: String, wrap: true, alignVertical: 'top' as const, ...extra });
  const bold = (value: string) => text(value, { fontWeight: 'bold' });
  const headerRow = (kind: ImportKind) => header(kind).map(head);
  const widths = (kind: ImportKind) => IMPORT_COLUMNS[kind].map(() => ({ width: 28 }));
  const teacherRow = IMPORT_COLUMNS.teachers.map((c) => (TEXT_COLUMNS.has(c.key) ? { type: String, format: '@' } : null));
  const teacherRows = Array.from({ length: IMPORT_MAX_ROWS }, () => teacherRow);

  const { en, si } = opts.instructions;
  // The first row is a title, not column headings, so the importer skips these sheets.
  const howTo = [
    [text(en[0] ?? '', { fontWeight: 'bold', fontSize: 14 }), text(si[0] ?? '', { fontWeight: 'bold', fontSize: 14 })],
    ...en.slice(1).map((line, i) => [text(line), text(si[i + 1] ?? '')]),
    [],
    [bold(`${opts.labels.titles}: ${TEACHER_TITLES.join(', ')}`)],
    [bold(`${opts.labels.grades}: ${opts.grades.join(', ')}`)],
    [bold(`${opts.labels.staffId}: ${formatStaffId(opts.staffPrefix, 1)}`)],
    [],
    [text(opts.headings.columns, { fontWeight: 'bold', fontSize: 12 })],
    ...IMPORT_COLUMNS.teachers.map((c) => [bold(`${c.en} / ${c.si}`), text(opts.columnHelp[c.key].en), text(opts.columnHelp[c.key].si)]),
  ];
  const examples = exampleTeachers({ staffPrefix: opts.staffPrefix, grades: opts.grades, subjects: opts.subjects, names: opts.exampleNames });
  const exampleSheet = [
    [text(opts.headings.example, { fontWeight: 'bold', textColor: MUTED })],
    headerRow('teachers'),
    ...examples.map((ex) => IMPORT_COLUMNS.teachers.map((c) => text(ex[c.key] ?? '', { backgroundColor: EXAMPLE_FILL, fontStyle: 'italic', textColor: MUTED }))),
  ];

  return writeXlsxFile([
    { sheet: opts.sheetNames.howTo, data: howTo as never, columns: [{ width: 44 }, { width: 60 }, { width: 60 }] },
    {
      sheet: opts.sheetNames.subjects,
      data: [headerRow('subjects'), ...(opts.subjects ?? []).map((s) => subjectCells(s).map((value) => ({ value, type: String })))],
      columns: widths('subjects'),
      stickyRowsCount: 1,
    },
    { sheet: opts.sheetNames.teachers, data: [headerRow('teachers'), ...teacherRows], columns: widths('teachers'), stickyRowsCount: 1 },
    { sheet: opts.sheetNames.example, data: exampleSheet as never, columns: widths('teachers'), stickyRowsCount: 2 },
  ]).toBlob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
