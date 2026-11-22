// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { parseCsv, readSheets } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { templateCsv } from './template';

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
