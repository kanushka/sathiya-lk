// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS, parseCsv, readSheets } from '@sathiya/core';
import { createI18n } from '@sathiya/i18n';
import { describe, expect, it, vi } from 'vitest';
import { readImportFile } from './readFile';
import { sheetName, templateCsv, templateSheetNames, templateXlsx, type TemplateCopy } from './template';

const SHEET_NAMES = { howTo: 'How to fill - පුරවන ආකාරය', subjects: 'Subjects - විෂයන්', teachers: 'Teachers - ගුරුවරු', example: 'Example - උදාහරණ' };

const COPY = {
  instructions: { en: ['How to fill', 'Fill in rows'], si: ['පුරවන ආකාරය', 'පේළි පුරවන්න'] },
  labels: { titles: 'Titles / ගෞරව නාම', grades: 'Grades / ශ්‍රේණි', staffId: 'Staff ID / සේවක අංකය' },
  headings: { columns: 'Columns', example: 'Example rows' },
  columnHelp: Object.fromEntries(IMPORT_COLUMNS.teachers.map((c) => [c.key, { en: `${c.key} help`, si: `${c.key} උදව්` }])) as TemplateCopy['columnHelp'],
  exampleNames: [{ en: 'K. Perera', si: 'කේ. පෙරේරා' }, { en: 'S. Fernando', si: 'එස්. ප්‍රනාන්දු' }],
} satisfies TemplateCopy;

const written = vi.hoisted(() => [] as { sheet: string; data: unknown[][] }[][]);
vi.mock('write-excel-file/browser', async (importOriginal) => {
  const real = await importOriginal<typeof import('write-excel-file/browser')>();
  return {
    default: ((sheets: { sheet: string; data: unknown[][] }[]) => {
      written.push(sheets);
      return real.default(sheets as never);
    }) as unknown as typeof real.default,
  };
});

describe('templateCsv', () => {
  it.each(['subjects', 'teachers'] as const)('%s: BOM + header that parses cleanly', (kind) => {
    const csv = templateCsv(kind);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    const parsed = readSheets([{ name: 't', rows }]);
    expect(parsed.errors).toEqual([]);
    expect(parsed[kind]).toEqual([]);
  });
});

describe('templateXlsx', () => {
  it('puts How to fill first, with English and Sinhala side by side and the school values', async () => {
    const blob = await templateXlsx({ ...COPY, staffPrefix: 'SCC', grades: [6, 7], sheetNames: SHEET_NAMES });
    const sheets = await readImportFile(new File([blob], 't.xlsx'));
    expect(sheets.map((s) => s.name)).toEqual([SHEET_NAMES.howTo, SHEET_NAMES.subjects, SHEET_NAMES.teachers, SHEET_NAMES.example]);
    const rows = sheets[0]!.rows;
    expect(rows).toContainEqual(['Fill in rows', 'පේළි පුරවන්න', null]);
    expect(rows).toContainEqual(['Staff ID / සේවක අංකය', 'staffId help', 'staffId උදව්']);
    const howTo = rows.map((r) => r[0]);
    expect(howTo).toEqual(
      expect.arrayContaining([
        'Titles / ගෞරව නාම: Mr, Mrs, Miss, Ms, Dr, Rev, Ven.',
        'Grades / ශ්‍රේණි: 6, 7',
        'Staff ID / සේවක අංකය: SCC001',
      ]),
    );
    expect(howTo.join('\n')).not.toMatch(/^(Titles|Grades|Staff ID):/m);
  });
});

describe('templateXlsx text columns', () => {
  it('formats Staff ID, Phone and Grades data cells as text so Excel keeps 6-9 and leading zeros', async () => {
    written.length = 0;
    await templateXlsx({ ...COPY, staffPrefix: 'T', grades: [6], sheetNames: SHEET_NAMES });
    const teachers = written[0]!.find((s) => s.sheet === SHEET_NAMES.teachers)!.data;
    expect(teachers).toHaveLength(1 + IMPORT_MAX_ROWS);
    const keys = IMPORT_COLUMNS.teachers.map((c) => c.key);
    for (const row of teachers.slice(1)) {
      for (const k of ['staffId', 'phone', 'grades'] as const) {
        expect(row[keys.indexOf(k)]).toEqual({ type: String, format: '@' });
      }
    }
  });
});

describe('template sheet names', () => {
  it('are bilingual and valid Excel sheet names', () => {
    const names = Object.values(templateSheetNames(createI18n('en')));
    expect(names).toEqual(Object.values(SHEET_NAMES));
    for (const n of names) {
      expect(n.length).toBeLessThanOrEqual(31);
      expect(n).not.toMatch(/[:\\/?*[\]]/);
    }
  });

  it('fall back to English when the bilingual name would be invalid', () => {
    expect(sheetName('Teachers', 'ගුරුවරු'.repeat(5))).toBe('Teachers');
    expect(sheetName('Teachers', 'a/b')).toBe('Teachers');
  });
});

describe('pre-filled subjects', () => {
  it('lists the given subjects under the header in the CSV and they read back as subjects', () => {
    const csv = templateCsv('subjects', [{ nameEn: 'Tamil', nameSi: 'දෙමළ', short: 'Tam' }, { nameEn: 'Pali', short: 'Pali' }]);
    const parsed = readSheets([{ name: 't', rows: parseCsv(csv) }]);
    expect(parsed.errors).toEqual([]);
    expect(parsed.subjects.map((r) => r.cells)).toEqual([{ nameEn: 'Tamil', nameSi: 'දෙමළ', short: 'Tam' }, { nameEn: 'Pali', short: 'Pali' }]);
    expect(parseCsv(templateCsv('teachers', [{ nameEn: 'Tamil', short: 'Tam' }]))).toHaveLength(1);
  });
});

describe('pre-filled Excel template', () => {
  it('puts the given subjects on the Subjects sheet so they import as-is', async () => {
    const blob = await templateXlsx({
      ...COPY,
      staffPrefix: 'SCC',
      grades: [6],
      sheetNames: SHEET_NAMES,
      subjects: [{ nameEn: 'Tamil', nameSi: 'දෙමළ', short: 'Tam' }],
    });
    const parsed = readSheets(await readImportFile(new File([blob], 't.xlsx')));
    expect(parsed.errors).toEqual([]);
    expect(parsed.subjects.map((r) => r.cells)).toEqual([{ nameEn: 'Tamil', nameSi: 'දෙමළ', short: 'Tam' }]);
  });
});

describe('Example sheet', () => {
  it('shows filled-in teachers that the importer skips', async () => {
    const blob = await templateXlsx({
      ...COPY,
      staffPrefix: 'SCC',
      grades: [1, 2, 3, 6, 7],
      sheetNames: SHEET_NAMES,
      subjects: [{ nameEn: 'Mathematics', short: 'Math' }, { nameEn: 'Science', short: 'Sci' }],
    });
    const sheets = await readImportFile(new File([blob], 't.xlsx'));
    const example = sheets.find((s) => s.name === SHEET_NAMES.example)!.rows;
    const keys = IMPORT_COLUMNS.teachers.map((c) => c.key);
    const cell = (row: unknown[], k: (typeof keys)[number]) => row[keys.indexOf(k)];
    expect(cell(example[2]!, 'staffId')).toBe('SCC001');
    expect(cell(example[2]!, 'name')).toBe('K. Perera');
    expect(cell(example[2]!, 'subjects')).toBe('Math, Sci');
    expect(cell(example[2]!, 'grades')).toBe('1-3, 6-7');
    expect(cell(example[3]!, 'isPrimary')).toBe('Yes');
    const parsed = readSheets(sheets);
    expect(parsed.errors).toEqual([]);
    expect(parsed.teachers).toEqual([]);
  });
});
