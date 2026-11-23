// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { formatStaffId, IMPORT_COLUMNS, IMPORT_MAX_ROWS, TEACHER_TITLES, type ImportKind, type TeacherColumn } from '@sathiya/core';
import type { i18n as I18n } from 'i18next';

// Excel turns "6-9" into a date and drops a phone's leading 0 unless the cell is formatted as text.
const TEXT_COLUMNS: ReadonlySet<TeacherColumn> = new Set(['staffId', 'phone', 'grades']);

const header = (kind: ImportKind) =>
  IMPORT_COLUMNS[kind].map((c) => `${c.en} / ${c.si}${c.required ? ' *' : ''}`);

export function templateCsv(kind: ImportKind): string {
  const cells = header(kind).map((h) => `"${h.replace(/"/g, '""')}"`);
  return `\uFEFF${cells.join(',')}\r\n`;
}

const SHEET_NAME_MAX = 31;
const SHEET_NAME_BAD = /[:\\/?*[\]]/;

// Excel refuses to open a workbook whose sheet names break these rules, so fall back to English.
export function sheetName(en: string, si: string): string {
  const both = `${en} - ${si}`;
  return both.length <= SHEET_NAME_MAX && !SHEET_NAME_BAD.test(both) ? both : en;
}

export interface TemplateSheetNames {
  subjects: string;
  teachers: string;
  howTo: string;
}

export function templateSheetNames(i18n: Pick<I18n, 'getFixedT'>): TemplateSheetNames {
  const en = i18n.getFixedT('en', 'import');
  const si = i18n.getFixedT('si', 'import');
  const name = (k: keyof TemplateSheetNames) => sheetName(en(`templateSheets.${k}`), si(`templateSheets.${k}`));
  return { subjects: name('subjects'), teachers: name('teachers'), howTo: name('howTo') };
}

export async function templateXlsx(opts: {
  staffPrefix: string;
  grades: number[];
  instructions: { en: string[]; si: string[] };
  labels: { titles: string; grades: string; staffId: string };
  sheetNames: TemplateSheetNames;
}): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const bold = (value: string) => ({ value, fontWeight: 'bold' as const });
  const headerRow = (kind: ImportKind) => header(kind).map(bold);
  const widths = (kind: ImportKind) => IMPORT_COLUMNS[kind].map(() => ({ width: 28 }));
  const teacherRow = IMPORT_COLUMNS.teachers.map((c) => (TEXT_COLUMNS.has(c.key) ? { type: String, format: '@' } : null));
  const teacherRows = Array.from({ length: IMPORT_MAX_ROWS }, () => teacherRow);
  const howTo = [
    ...opts.instructions.en,
    ...opts.instructions.si,
    '',
    `${opts.labels.titles}: ${TEACHER_TITLES.join(', ')}`,
    `${opts.labels.grades}: ${opts.grades.join(', ')}`,
    `${opts.labels.staffId}: ${formatStaffId(opts.staffPrefix, 1)}`,
  ].map((line) => [line]);
  return writeXlsxFile([
    { sheet: opts.sheetNames.subjects, data: [headerRow('subjects')], columns: widths('subjects'), stickyRowsCount: 1 },
    { sheet: opts.sheetNames.teachers, data: [headerRow('teachers'), ...teacherRows], columns: widths('teachers'), stickyRowsCount: 1 },
    { sheet: opts.sheetNames.howTo, data: howTo, columns: [{ width: 100 }] },
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
