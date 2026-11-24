// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { validateTemplate } from './templateValidate';

const withRow = (start: string, end: string) => validateTemplate({ name: 'T', mode: 'same', rows: [{ type: 'period', start, end }] });

describe('validateTemplate clock values', () => {
  it('accepts 00:00 to 23:59', () => {
    expect(withRow('00:00', '23:59')).toEqual([]);
  });

  it.each([
    ['07:00', '24:00'],
    ['25:00', '25:40'],
    ['07:00', '12:60'],
  ])('rejects %s–%s as empty', (start, end) => {
    expect(withRow(start, end)).toEqual([{ code: 'empty', day: null, row: 0 }]);
  });
});
