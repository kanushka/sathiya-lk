// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { nameTaken, shortTaken, suggestSubjectShort } from './subjectShort';
import { STANDARD_SUBJECTS } from './standardSubjects';

describe('suggestSubjectShort', () => {
  it.each([
    ['English', 'Eng'],
    ['Mathematics', 'Math'],
    ['Information & Communication Technology', 'ICT'],
    ['information and communication technology', 'ICT'],
    ['Health & Physical Education', 'HPE'],
    ['Agriculture', 'Agri'],
    ['Drama', 'Dra'],
    ['Art', 'Art'],
    ['Pali', 'Pali'],
    ['Home Science', 'HS'],
    ['  oriental   music ', 'OM'],
  ])('%s → %s', (name, short) => {
    expect(suggestSubjectShort(name, [])).toBe(short);
  });

  it('uses the first word of a non-Latin name', () => {
    expect(suggestSubjectShort('ගණිතය', [])).toBe('ගණිතය');
    expect(suggestSubjectShort('ගණිතය', ['ගණිතය'])).toBe('ගණිතය2');
    expect(suggestSubjectShort('දහම් පාසල', [])).toBe('දහම්');
    expect(suggestSubjectShort('  ', [])).toBe('');
  });

  it('is unique among existing short names, ignoring case', () => {
    expect(suggestSubjectShort('English', ['eng'])).toBe('Engl');
    expect(suggestSubjectShort('English', ['Eng', 'ENGL'])).toBe('Eng2');
    expect(suggestSubjectShort('English', ['Eng', 'Engl', 'eng2'])).toBe('Eng3');
    expect(suggestSubjectShort('Home Science', ['HS'])).toBe('HS2');
    expect(suggestSubjectShort('Mathematics', ['math'])).toBe('Math2');
  });

  it('knows every standard subject', () => {
    for (const s of STANDARD_SUBJECTS) expect(suggestSubjectShort(s.nameEn, [])).toBe(s.short);
  });
});

describe('shortTaken', () => {
  it('compares trimmed and case-insensitive', () => {
    expect(shortTaken(' eng ', ['Eng'])).toBe(true);
    expect(shortTaken('Engl', ['Eng'])).toBe(false);
    expect(shortTaken('', [''])).toBe(false);
  });
});

describe('STANDARD_SUBJECTS', () => {
  it('has unique names and short names that fit a cell', () => {
    const names = STANDARD_SUBJECTS.map((s) => s.nameEn.toLowerCase());
    const shorts = STANDARD_SUBJECTS.map((s) => s.short.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(shorts).size).toBe(shorts.length);
    for (const s of STANDARD_SUBJECTS) {
      expect(s.short.length).toBeLessThanOrEqual(4);
      expect(s.nameSi).not.toBe('');
      expect(s.color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('nameTaken', () => {
  const existing = ['Mathematics', 'Science & Technology'];
  it('matches ignoring case and surrounding or repeated whitespace', () => {
    expect(nameTaken('mathematics', existing)).toBe(true);
    expect(nameTaken('  MATHEMATICS ', existing)).toBe(true);
    expect(nameTaken('Science  &  Technology', existing)).toBe(true);
  });
  it('is false for a different or empty name', () => {
    expect(nameTaken('Maths', existing)).toBe(false);
    expect(nameTaken('   ', ['', ' '])).toBe(false);
  });
});
