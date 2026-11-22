// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { readSheets } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { ImportFileError, readImportFile } from './readFile';
import { templateXlsx } from './template';

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
    });
    const sheets = await readImportFile(asFile([blob], 't.xlsx'));
    expect(sheets.map((s) => s.name)).toEqual(['Subjects', 'Teachers', 'How to fill']);
    const parsed = readSheets(sheets);
    expect(parsed.errors).toEqual([]);
    expect(parsed.subjects).toEqual([]);
    expect(parsed.teachers).toEqual([]);
  });
});
