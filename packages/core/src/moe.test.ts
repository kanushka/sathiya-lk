// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { parseGradeSpan, parseMedium, titleCase, toMoeSchool } from './moe';

describe('parseGradeSpan', () => {
  it('expands spans with or without prefix', () => {
    expect(parseGradeSpan('4.Grd 1-13')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(parseGradeSpan('Grd 6-11')).toEqual([6, 7, 8, 9, 10, 11]);
    expect(parseGradeSpan('1.Grd 1-5')).toEqual([1, 2, 3, 4, 5]);
  });
  it('returns nothing for junk', () => {
    expect(parseGradeSpan('')).toEqual([]);
    expect(parseGradeSpan('Grd 9-3')).toEqual([]);
  });
});

describe('parseMedium', () => {
  it('maps letters to languages', () => {
    expect(parseMedium('4.S/E')).toEqual(['si', 'en']);
    expect(parseMedium('S')).toEqual(['si']);
    expect(parseMedium('2.T')).toEqual(['ta']);
    expect(parseMedium('6.S/T/E')).toEqual(['si', 'ta', 'en']);
    expect(parseMedium('')).toEqual([]);
  });
});

describe('titleCase', () => {
  it('keeps acronyms upper', () => {
    expect(titleCase('KOTAHENA M.M.V.')).toBe('Kotahena M.M.V.');
    expect(titleCase('MODARA ST. ANTHONY\'S B.M.V.')).toBe("Modara St. Anthony's B.M.V.");
    expect(titleCase('COLOMBO D.S.SENANAYAKE COLLEGE')).toBe('Colombo D.S.Senanayake College');
    expect(titleCase('KOTAHENA KUMARA V.')).toBe('Kotahena Kumara V.');
  });
  it('handles hyphens and spacing', () => {
    expect(titleCase('  AL-MANAR   CENTRAL COLLEGE ')).toBe('Al-Manar Central College');
  });
});

describe('toMoeSchool', () => {
  it('expands a compact entry', () => {
    expect(
      toMoeSchool('00023', { n: 'KOTAHENA M.M.V.', a: 'X', l: 'National', g: 'Grd 6-13', m: 'S/E', s: 'Mixed', p: 'Western', d: 'Colombo', z: 'Colombo' }),
    ).toEqual({
      censusNo: '00023',
      name: 'Kotahena M.M.V.',
      address: 'X',
      level: 'National',
      grades: [6, 7, 8, 9, 10, 11, 12, 13],
      media: ['si', 'en'],
      sex: 'Mixed',
      province: 'Western',
      district: 'Colombo',
      zone: 'Colombo',
    });
  });
});
