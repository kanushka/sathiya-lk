// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS, IMPORT_MAX_ROWS, cellText, parseCsv, readSheets } from './importSheet';

describe('parseCsv', () => {
  it('handles quotes, escapes, CRLF and embedded newlines', () => {
    expect(parseCsv('a,"b,""c"""\r\n1,"x\ny"\n')).toEqual([
      ['a', 'b,"c"'],
      ['1', 'x\ny'],
    ]);
  });
  it('strips a BOM and gives no empty row for a trailing newline', () => {
    expect(parseCsv('﻿a,b\n')).toEqual([['a', 'b']]);
  });
});

describe('cellText', () => {
  it('normalises values', () => {
    expect(cellText(6)).toBe('6');
    expect(cellText(null)).toBe('');
    expect(cellText(undefined)).toBe('');
    expect(cellText(true)).toBe('Yes');
    expect(cellText(false)).toBe('No');
    expect(cellText('  x ')).toBe('x');
    expect(cellText(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
  });
});

describe('IMPORT_COLUMNS', () => {
  it('marks the required columns', () => {
    const req = (k: 'subjects' | 'teachers') => IMPORT_COLUMNS[k].filter((c) => c.required).map((c) => c.key);
    expect(req('subjects')).toEqual(['nameEn']);
    expect(req('teachers')).toEqual(['name']);
  });
});

describe('readSheets', () => {
  it('matches combined, English-only and Sinhala-only headers', () => {
    const r = readSheets([
      { name: 'Teachers', rows: [['Full name / සම්පූර්ණ නම *', 'grades', 'දුරකථන'], ['A', '6', '0771234567']] },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.teachers[0]).toEqual({ row: 2, cells: { name: 'A', grades: '6', phone: '0771234567' } });
  });

  it('ignores instruction sheets', () => {
    const r = readSheets([
      { name: 'Help', rows: [['How to fill'], ['...']] },
      { name: 'Subjects', rows: [['Name (English) / නම (ඉංග්‍රීසි) *', 'Short name'], ['Maths', 'Math']] },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.teachers).toEqual([]);
    expect(r.subjects).toEqual([{ row: 2, cells: { nameEn: 'Maths', short: 'Math' } }]);
  });

  it('reports unknown headers', () => {
    const r = readSheets([{ name: 'T', rows: [['Full name', 'Notes'], ['A', 'x']] }]);
    expect(r.errors).toEqual([
      { sheet: 'teachers', row: 1, column: null, code: 'unknownHeader', params: { header: 'Notes' } },
    ]);
    expect(r.teachers[0]?.cells).toEqual({ name: 'A' });
  });

  it('reports a column header repeated under another spelling', () => {
    const r = readSheets([{ name: 'T', rows: [['Full name', 'Grades', 'ශ්‍රේණි'], ['A', '6', '7']] }]);
    expect(r.errors).toEqual([
      { sheet: 'teachers', row: 1, column: null, code: 'unknownHeader', params: { header: 'ශ්‍රේණි' } },
    ]);
    expect(r.teachers[0]?.cells).toEqual({ name: 'A', grades: '6' });
  });

  it('reports a missing required header', () => {
    const r = readSheets([{ name: 'T', rows: [['Staff ID'], ['S1']] }]);
    expect(r.errors).toContainEqual({
      sheet: 'teachers',
      row: 1,
      column: 'name',
      code: 'missingHeader',
      params: { header: 'Full name', column: 'name' },
    });
  });

  it('skips blank rows and keeps real row numbers', () => {
    const r = readSheets([{ name: 'T', rows: [['Full name'], ['', null, '  '], ['B']] }]);
    expect(r.teachers).toEqual([{ row: 3, cells: { name: 'B' } }]);
  });

  it('flags a second sheet of the same kind', () => {
    const r = readSheets([
      { name: 'T1', rows: [['Full name'], ['A']] },
      { name: 'T2', rows: [['Full name'], ['B']] },
    ]);
    expect(r.teachers).toEqual([{ row: 2, cells: { name: 'A' } }]);
    expect(r.errors).toEqual([{ sheet: 'teachers', row: null, column: null, code: 'duplicateSheet' }]);
  });

  it('caps rows', () => {
    const rows: unknown[][] = [['Full name']];
    for (let i = 0; i < IMPORT_MAX_ROWS + 1; i++) rows.push([`T${i}`]);
    const r = readSheets([{ name: 'T', rows }]);
    expect(r.errors).toEqual([
      { sheet: 'teachers', row: null, column: null, code: 'tooManyRows', params: { max: 200 } },
    ]);
  });

  it('reports a sheet whose headings fit subjects and teachers equally', () => {
    const r = readSheets([
      { name: 'Mixed', rows: [['Full name', 'Short name'], ['A', 'B']] },
      { name: 'Subjects', rows: [['Name (English)'], ['Maths']] },
    ]);
    expect(r.errors).toEqual([{ sheet: 'file', row: null, column: null, code: 'ambiguousSheet', params: { name: 'Mixed' } }]);
    expect(r.subjects).toEqual([{ row: 2, cells: { nameEn: 'Maths' } }]);
    expect(r.teachers).toEqual([]);
    expect(readSheets([{ name: 'Mixed', rows: [['Full name', 'Short name']] }]).errors.map((e) => e.code)).toEqual(['ambiguousSheet']);
  });

  it('reports noSheets', () => {
    expect(readSheets([{ name: 'Help', rows: [['How to fill']] }]).errors).toEqual([
      { sheet: 'file', row: null, column: null, code: 'noSheets' },
    ]);
    expect(readSheets([]).errors).toHaveLength(1);
  });
});

describe('readSheets cell types', () => {
  it('records Date and number cells so validation can explain them', () => {
    const r = readSheets([
      { name: 'T', rows: [['Full name', 'Grades', 'Phone', 'Primary teacher?'], ['A', new Date(Date.UTC(2026, 5, 9)), 771234567, true]] },
    ]);
    expect(r.teachers[0]).toEqual({
      row: 2,
      cells: { name: 'A', grades: '2026-06-09', phone: '771234567', isPrimary: 'Yes' },
      cellTypes: { grades: 'date', phone: 'number' },
    });
  });

  it('omits cellTypes for text-only rows', () => {
    const r = readSheets([{ name: 'T', rows: [['Full name'], ['A']] }]);
    expect(r.teachers[0]).not.toHaveProperty('cellTypes');
  });
});

describe('readSheets header matching', () => {
  it('uses විෂයන් for Subjects and still accepts විෂයයන්', () => {
    expect(IMPORT_COLUMNS.teachers.find((c) => c.key === 'subjects')?.si).toBe('විෂයන්');
    for (const h of ['විෂයන්', 'විෂයයන්', 'Subjects / විෂයයන්']) {
      const r = readSheets([{ name: 'T', rows: [['Full name', h], ['A', 'Art']] }]);
      expect(r.errors).toEqual([]);
      expect(r.teachers[0]?.cells).toEqual({ name: 'A', subjects: 'Art' });
    }
  });

  it('ignores ZWJ/ZWNJ in headers', () => {
    const si = 'නම (ඉංග්‍රීසි)';
    const noZwj = si.replace(/\u200d/g, '');
    const r = readSheets([{ name: 'x', rows: [[noZwj, 'කෙටි නම'], ['Maths', 'Math']] }]);
    expect(r.errors).toEqual([]);
    expect(r.subjects[0]?.cells).toEqual({ nameEn: 'Maths', short: 'Math' });
  });

  it('strips trailing stars and stays fast on star-heavy headers', () => {
    const r = readSheets([{ name: 'x', rows: [['Full name  **', 'Grades*'], ['A', '6']] }]);
    expect(r.errors).toEqual([]);
    expect(r.teachers[0]?.cells).toEqual({ name: 'A', grades: '6' });
    const start = Date.now();
    readSheets([{ name: 'y', rows: [[`Full name${'*'.repeat(50_000)}x`]] }]);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
