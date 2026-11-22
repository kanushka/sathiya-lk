// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { parseCsv, type RawSheet } from '@sathiya/core';

export class ImportFileError extends Error {
  constructor(public reason: 'unsupported' | 'unreadable') {
    super(reason);
    this.name = 'ImportFileError';
  }
}

export async function readImportFile(file: File): Promise<RawSheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || (file.type === 'text/csv' && !name.endsWith('.xlsx'))) {
    try {
      return [{ name: file.name, rows: parseCsv(await file.text()) }];
    } catch {
      throw new ImportFileError('unreadable');
    }
  }
  if (!name.endsWith('.xlsx')) throw new ImportFileError('unsupported');
  try {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    return sheets.map((s) => ({ name: s.sheet, rows: s.data }));
  } catch {
    throw new ImportFileError('unreadable');
  }
}
