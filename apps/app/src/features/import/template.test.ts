// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS, parseCsv, readSheets } from '@sathiya/core';
import { createI18n } from '@sathiya/i18n';
import { describe, expect, it, vi } from 'vitest';
import { readImportFile } from './readFile';
import { sheetName, templateCsv, templateSheetNames, templateXlsx } from './template';

const SHEET_NAMES = { subjects: 'Subjects - විෂයන්', teachers: 'Teachers - ගුරුවරු', howTo: 'How to fill - පුරවන ආකාරය' };

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
  it('writes the given labels and school values into the How to fill sheet', async () => {
    const blob = await templateXlsx({
      staffPrefix: 'SCC',
      grades: [6, 7],
      instructions: { en: ['Fill in rows'], si: ['පේළි පුරවන්න'] },
      labels: { titles: 'Titles / ගෞරව නාම', grades: 'Grades / ශ්‍රේණි', staffId: 'Staff ID / සේවක අංකය' },
      sheetNames: SHEET_NAMES,
    });
    const sheets = await readImportFile(new File([blob], 't.xlsx'));
    expect(sheets.map((s) => s.name)).toEqual([SHEET_NAMES.subjects, SHEET_NAMES.teachers, SHEET_NAMES.howTo]);
    const howTo = sheets.find((s) => s.name === SHEET_NAMES.howTo)!.rows.map((r) => r[0]);
    expect(howTo).toEqual(
      expect.arrayContaining([
        'Fill in rows',
        'පේළි පුරවන්න',
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
    await templateXlsx({ staffPrefix: 'T', grades: [6], instructions: { en: [], si: [] }, labels: { titles: 'a', grades: 'b', staffId: 'c' }, sheetNames: SHEET_NAMES });
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
    expect(names).toEqual(['Subjects - විෂයන්', 'Teachers - ගුරුවරු', 'How to fill - පුරවන ආකාරය']);
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
