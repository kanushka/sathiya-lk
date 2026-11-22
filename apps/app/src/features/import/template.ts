// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { formatStaffId, IMPORT_COLUMNS, TEACHER_TITLES, type ImportKind } from '@sathiya/core';

const header = (kind: ImportKind) =>
  IMPORT_COLUMNS[kind].map((c) => `${c.en} / ${c.si}${c.required ? ' *' : ''}`);

export function templateCsv(kind: ImportKind): string {
  const cells = header(kind).map((h) => `"${h.replace(/"/g, '""')}"`);
  return `\uFEFF${cells.join(',')}\r\n`;
}

export async function templateXlsx(opts: {
  staffPrefix: string;
  grades: number[];
  instructions: { en: string[]; si: string[] };
}): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const bold = (value: string) => ({ value, fontWeight: 'bold' as const });
  const headerRow = (kind: ImportKind) => header(kind).map(bold);
  const widths = (kind: ImportKind) => IMPORT_COLUMNS[kind].map(() => ({ width: 28 }));
  const howTo = [
    ...opts.instructions.en,
    ...opts.instructions.si,
    '',
    `Titles: ${TEACHER_TITLES.join(', ')}`,
    `Grades: ${opts.grades.join(', ')}`,
    `Staff ID: ${formatStaffId(opts.staffPrefix, 1)}`,
  ].map((line) => [line]);
  return writeXlsxFile([
    { sheet: 'Subjects', data: [headerRow('subjects')], columns: widths('subjects'), stickyRowsCount: 1 },
    { sheet: 'Teachers', data: [headerRow('teachers')], columns: widths('teachers'), stickyRowsCount: 1 },
    { sheet: 'How to fill', data: howTo, columns: [{ width: 100 }] },
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
