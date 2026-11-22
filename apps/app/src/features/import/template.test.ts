// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { parseCsv, readSheets } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { readImportFile } from './readFile';
import { templateCsv, templateXlsx } from './template';

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
    });
    const sheets = await readImportFile(new File([blob], 't.xlsx'));
    const howTo = sheets.find((s) => s.name === 'How to fill')!.rows.map((r) => r[0]);
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
