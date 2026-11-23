// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { hasName, normalizeTeacher, pickName, splitTitle, TEACHER_TITLE_LABELS, teacherDisplayName, teacherNameMissing } from './names';
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

describe('normalizeTeacher', () => {
  it('reads a legacy Thero title as Ven. with Thero after the name', () => {
    expect(normalizeTeacher({ name: 'Ananda', title: 'Thero' })).toEqual({ name: 'Ananda Thero', title: 'Ven.' });
    expect(normalizeTeacher({ name: 'Ananda Thero', title: 'Thero' })).toEqual({ name: 'Ananda Thero', title: 'Ven.' });
    expect(normalizeTeacher({ name: ' Ananda thero ', title: 'Thero' })).toEqual({ name: 'Ananda thero', title: 'Ven.' });
  });
  it('leaves other teachers untouched and keeps extra fields', () => {
    const t = { id: 'x', name: 'N. Perera', title: 'Mrs' as const };
    expect(normalizeTeacher(t)).toBe(t);
  });
  it('displays a legacy Thero record as Ven. <name> Thero', () => {
    expect(teacherDisplayName({ name: 'Ananda', title: 'Thero' as never })).toBe('Ven. Ananda Thero');
  });
});

describe('teacherDisplayName', () => {
  it('lists the titles in a fixed order', () => {
    expect(TEACHER_TITLES).toEqual(['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Rev', 'Ven.']);
  });
  it.each([
    ['Mr', 'Mr. N. Perera'],
    ['Mrs', 'Mrs. N. Perera'],
    ['Miss', 'Miss N. Perera'],
    ['Ms', 'Ms. N. Perera'],
    ['Dr', 'Dr. N. Perera'],
    ['Rev', 'Rev. N. Perera'],
    ['Ven.', 'Ven. N. Perera'],
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
  it('uses Sinhala labels with the Sinhala name', () => {
    for (const title of TEACHER_TITLES) {
      const si = teacherDisplayName({ name: 'N. Perera', nameSi: 'එන්. පෙරේරා', title }, 'si');
      expect(si).toContain('එන්. පෙරේරා');
      expect(si).toContain(TEACHER_TITLE_LABELS.si[title]);
      expect(TEACHER_TITLE_LABELS.si[title].trim()).not.toBe('');
    }
    expect(teacherDisplayName({ name: 'Mrs. N. Perera' }, 'si')).toBe('Mrs. N. Perera');
    expect(teacherDisplayName({ name: 'N. Perera' }, 'si')).toBe('N. Perera');
  });
});

describe('names in either language', () => {
  it('pickName falls back to Sinhala when English is empty', () => {
    expect(pickName({ nameEn: '', nameSi: 'දහම් පාසල' }, 'en')).toBe('දහම් පාසල');
    expect(pickName({ nameEn: '  ', nameSi: 'දහම් පාසල' }, 'si')).toBe('දහම් පාසල');
    expect(pickName({ nameEn: '' }, 'en')).toBe('');
  });
  it('hasName needs at least one non-blank name', () => {
    expect(hasName({ nameEn: 'Maths' })).toBe(true);
    expect(hasName({ nameEn: '', nameSi: 'ගණිතය' })).toBe(true);
    expect(hasName({ nameEn: ' ', nameSi: ' ' })).toBe(false);
  });
  it('shows the Sinhala name with a Sinhala title on Sinhala screens', () => {
    expect(teacherDisplayName({ name: 'N. Perera', nameSi: 'එන්. පෙරේරා', title: 'Mrs' }, 'si')).toBe('එන්. පෙරේරා මහත්මිය');
    expect(teacherDisplayName({ name: 'N. Perera', nameSi: 'එන්. පෙරේරා', title: 'Mrs' }, 'en')).toBe('Mrs. N. Perera');
  });
  it('formats the title in the language of the name that is shown', () => {
    expect(teacherDisplayName({ name: '', nameSi: 'ජී. ජයසේකර', title: 'Mr' }, 'en')).toBe('ජී. ජයසේකර මහතා');
    expect(teacherDisplayName({ name: 'A. Rizan', title: 'Mr' }, 'si')).toBe('Mr. A. Rizan');
    expect(teacherDisplayName({ name: '', nameSi: 'ආනන්ද හිමි', title: 'Ven.' }, 'en')).toBe('පූජ්‍ය ආනන්ද හිමි');
  });
  it('teacherNameMissing says when the current language has no name', () => {
    expect(teacherNameMissing({ name: 'A. Rizan' }, 'si')).toBe(true);
    expect(teacherNameMissing({ name: 'A. Rizan' }, 'en')).toBe(false);
    expect(teacherNameMissing({ name: '', nameSi: 'ජී. ජයසේකර' }, 'en')).toBe(true);
  });

  it('reads a legacy Thero title before the Sinhala name', () => {
    expect(teacherDisplayName({ name: 'Ananda', nameSi: 'ආනන්ද හිමි', title: 'Thero' as never }, 'si')).toBe('පූජ්‍ය ආනන්ද හිමි');
  });
});
