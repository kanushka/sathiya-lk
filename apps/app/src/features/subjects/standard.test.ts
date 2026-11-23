// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { STANDARD_SUBJECTS } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { missingDefaults, standardList } from './standard';

describe('standardList', () => {
  it('falls back to the built-in list when the platform list is missing or empty', () => {
    expect(standardList(undefined)).toEqual(STANDARD_SUBJECTS);
    expect(standardList([])).toEqual(STANDARD_SUBJECTS);
  });
  it('prefers the platform list when it has subjects', () => {
    const own = [{ nameEn: 'Drama', short: 'Dra', color: '#EBDDF2' }];
    expect(standardList(own)).toBe(own);
  });
});

describe('missingDefaults', () => {
  it('adds every standard subject to an empty school', () => {
    const added = missingDefaults([], standardList(undefined));
    expect(added).toHaveLength(STANDARD_SUBJECTS.length);
    expect(added).toContainEqual({ nameEn: 'English', nameSi: 'ඉංග්‍රීසි', short: 'Eng', color: '#E3E9D2' });
  });
  it('adds only the missing ones to a partial list', () => {
    const added = missingDefaults([{ nameEn: 'English' }, { nameEn: ' mathematics ' }], standardList(undefined));
    expect(added).toHaveLength(STANDARD_SUBJECTS.length - 2);
    expect(added.map((s) => s.nameEn)).not.toContain('English');
    expect(added.map((s) => s.nameEn)).not.toContain('Mathematics');
  });
});

describe('missingDefaults short names', () => {
  it('keeps added short names unique against existing ones', () => {
    const added = missingDefaults([{ nameEn: 'Mental Arithmetic', short: 'math' }], [{ nameEn: 'Mathematics', short: 'Math', color: '#D4ECEA' }]);
    expect(added).toEqual([{ nameEn: 'Mathematics', short: 'Math2', color: '#D4ECEA' }]);
  });
});

describe('missingDefaults aliases', () => {
  it('treats a known alias or matching short name as the same subject', () => {
    const added = missingDefaults(
      [{ nameEn: 'Maths', short: 'Maths' }, { nameEn: 'ICT', short: 'ICT' }],
      [
        { nameEn: 'Mathematics', short: 'Math', color: '#D4ECEA' },
        { nameEn: 'Information & Communication Technology', short: 'ICT', color: '#DDEFF2' },
        { nameEn: 'Science', short: 'Sci', color: '#DCE7FA' },
      ],
    );
    expect(added.map((s) => s.nameEn)).toEqual(['Science']);
  });
  it('never leaves a colliding entry with an empty short name', () => {
    const added = missingDefaults([{ nameEn: 'Other', short: 'X' }], [{ nameEn: 'වෙනත්', short: 'x', color: '#E9E9E9' }]);
    expect(added).toEqual([{ nameEn: 'වෙනත්', short: 'වෙනත්', color: '#E9E9E9' }]);
  });

  it('adds only one default per Sinhala name', () => {
    const added = missingDefaults(
      [],
      [
        { nameEn: 'Mathematics', nameSi: 'ගණිතය', short: 'Maths', color: '#D4ECEA' },
        { nameEn: 'Arithmetic', nameSi: 'ගණිතය', short: 'Arith', color: '#D4ECEA' },
      ],
    );
    expect(added.map((d) => d.nameEn)).toEqual(['Mathematics']);
  });
});
