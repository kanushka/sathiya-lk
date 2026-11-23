// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { readSheets, validateImport } from '@sathiya/core';
import { createI18n } from '@sathiya/i18n';
import writeXlsxFile from 'write-excel-file/browser';
import { describe, expect, it } from 'vitest';
import { ImportFileError, readImportFile } from './readFile';
import { templateSheetNames, templateXlsx } from './template';

const asFile = (parts: BlobPart[], name: string) => new File(parts, name);

describe('readImportFile', () => {
  it('reads a csv file as one sheet', async () => {
    const file = asFile(['Name (English) / නම (ඉංග්‍රීසි)\nDrama\n'], 'subjects.csv');
    const sheets = await readImportFile(file);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.name).toBe('subjects.csv');
    expect(sheets[0]?.rows).toHaveLength(2);
  });

  it('rejects unsupported extensions', async () => {
    const err = await readImportFile(asFile(['x'], 'a.txt')).catch((e) => e);
    expect(err).toBeInstanceOf(ImportFileError);
    expect(err.reason).toBe('unsupported');
  });

  it('rejects a corrupt xlsx as unreadable', async () => {
    const err = await readImportFile(asFile(['not a zip'], 'a.xlsx')).catch((e) => e);
    expect(err).toBeInstanceOf(ImportFileError);
    expect(err.reason).toBe('unreadable');
  });

  it('round-trips the xlsx template', async () => {
    const blob = await templateXlsx({
      staffPrefix: 'T',
      grades: [6, 7],
      instructions: { en: ['Fill in rows'], si: ['පේළි පුරවන්න'] },
      labels: { titles: 'Titles', grades: 'Grades', staffId: 'Staff ID' },
      sheetNames: templateSheetNames(createI18n('en')),
    });
    const sheets = await readImportFile(asFile([blob], 't.xlsx'));
    expect(sheets.map((s) => s.name)).toEqual(['Subjects - විෂයන්', 'Teachers - ගුරුවරු', 'How to fill - පුරවන ආකාරය']);
    const parsed = readSheets(sheets);
    expect(parsed.errors).toEqual([]);
    expect(parsed.subjects).toEqual([]);
    expect(parsed.teachers).toEqual([]);
  });
});

describe('xlsx round trip with spreadsheet-typed cells', () => {
  it('explains grades Excel turned into a date and a phone that lost its leading 0', async () => {
    const header = ['Full name', 'Subjects', 'Grades', 'Phone', 'Primary teacher?'];
    const blob = await writeXlsxFile([
      {
        sheet: 'Teachers',
        data: [
          header,
          ['K. Perera', null, { value: new Date(Date.UTC(2026, 5, 9)), type: Date, format: 'd-mmm' }, 771234567, true],
          ['S. Silva', 'Art, Craft; Music', '6-9', '0771234567', false],
        ],
      },
      { sheet: 'Subjects', data: [['Name (English)'], ['Art, Craft'], ['Music']] },
    ]).toBlob();
    const parsed = readSheets(await readImportFile(asFile([blob], 'filled.xlsx')));
    expect(parsed.errors).toEqual([]);
    const plan = validateImport(parsed, { staffPrefix: 'TT', schoolGrades: [6, 7, 8, 9], subjects: [], staffIds: [] });
    expect(plan.errors).toEqual([
      { sheet: 'teachers', row: 2, column: 'phone', code: 'excelNumber' },
      { sheet: 'teachers', row: 2, column: 'grades', code: 'excelDate' },
    ]);
    expect(plan.teachers[0]?.teacher.isPrimary).toBe(true);
    expect(plan.teachers[1]?.teacher).toMatchObject({ grades: [6, 7, 8, 9], phone: '0771234567', isPrimary: false });
    expect(plan.teachers[1]?.subjectRefs).toEqual([{ newIndex: 0 }, { newIndex: 1 }]);
  });
});
