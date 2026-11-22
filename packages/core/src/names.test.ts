// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { pickName, splitTitle, TEACHER_TITLE_LABELS, teacherDisplayName } from './names';
import { TEACHER_TITLES } from './types';

describe('pickName', () => {
  it('falls back to English when Sinhala empty', () => {
    expect(pickName({ nameEn: 'Maths', nameSi: '' }, 'si')).toBe('Maths');
    expect(pickName({ nameEn: 'Maths', nameSi: '  ' }, 'si')).toBe('Maths');
    expect(pickName({ nameEn: 'Maths' }, 'si')).toBe('Maths');
  });
  it('uses Sinhala when present', () => {
    expect(pickName({ nameEn: 'Maths', nameSi: 'ගණිතය' }, 'si')).toBe('ගණිතය');
  });
  it('en returns English', () => {
    expect(pickName({ nameEn: 'Maths', nameSi: 'ගණිතය' }, 'en')).toBe('Maths');
  });
});

describe('splitTitle', () => {
  it.each([
    ['Mrs. N. Perera', 'Mrs', 'N. Perera'],
    ['mr r. silva', 'Mr', 'r. silva'],
    ['Miss K. Fernando', 'Miss', 'K. Fernando'],
    ['Ms. A. Wijesekara', 'Ms', 'A. Wijesekara'],
    ['DR. P. Bandara', 'Dr', 'P. Bandara'],
    ['Rev. Fr. M. Silva', 'Rev', 'Fr. M. Silva'],
    ['Ven. Ananda Thero', 'Ven.', 'Ananda Thero'],
    ['ven Ananda Thero', 'Ven.', 'Ananda Thero'],
  ])('splits %s', (input, title, name) => {
    expect(splitTitle(input)).toEqual({ title, name });
  });
  it.each(['Mrsimha Perera', 'Drona', 'Mr.', 'N. Perera', 'Ananda Thero'])('leaves %s alone', (input) => {
    expect(splitTitle(input)).toEqual({ name: input });
  });
});

describe('teacherDisplayName', () => {
  it('lists the titles in a fixed order', () => {
    expect(TEACHER_TITLES).toEqual(['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Rev', 'Ven.', 'Thero']);
  });
  it.each([
    ['Mr', 'Mr. N. Perera'],
    ['Mrs', 'Mrs. N. Perera'],
    ['Miss', 'Miss N. Perera'],
    ['Ms', 'Ms. N. Perera'],
    ['Dr', 'Dr. N. Perera'],
    ['Rev', 'Rev. N. Perera'],
    ['Ven.', 'Ven. N. Perera'],
    ['Thero', 'N. Perera Thero'],
  ] as const)('en %s', (title, expected) => {
    expect(teacherDisplayName({ name: 'N. Perera', title })).toBe(expected);
    expect(teacherDisplayName({ name: 'N. Perera', title }, 'en')).toBe(expected);
  });
  it('returns the bare name without a title', () => {
    expect(teacherDisplayName({ name: 'N. Perera' })).toBe('N. Perera');
  });
  it('normalises a legacy prefixed name without doubling', () => {
    expect(teacherDisplayName({ name: 'Mrs. N. Perera' })).toBe('Mrs. N. Perera');
    expect(teacherDisplayName({ name: 'mrs N. Perera' })).toBe('Mrs. N. Perera');
    expect(teacherDisplayName({ name: 'Mrs. N. Perera', title: 'Mrs' })).toBe('Mrs. N. Perera');
  });
  it('uses Sinhala labels in si', () => {
    for (const title of TEACHER_TITLES) {
      const si = teacherDisplayName({ name: 'N. Perera', title }, 'si');
      expect(si).toContain('N. Perera');
      expect(si).toContain(TEACHER_TITLE_LABELS.si[title]);
      expect(TEACHER_TITLE_LABELS.si[title].trim()).not.toBe('');
    }
    expect(teacherDisplayName({ name: 'Mrs. N. Perera' }, 'si')).toBe(`N. Perera ${TEACHER_TITLE_LABELS.si.Mrs}`);
    expect(teacherDisplayName({ name: 'N. Perera' }, 'si')).toBe('N. Perera');
  });
});
