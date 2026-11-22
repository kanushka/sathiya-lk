// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { importFingerprint, subjectsFingerprint } from './importFingerprint';

const maths = { id: 's1', nameEn: 'Mathematics', nameSi: 'ගණිතය', short: 'Math' };
const art = { id: 's2', nameEn: 'Art', short: 'Art' };

describe('subjectsFingerprint', () => {
  it('is a short hex string, independent of order and extra fields', () => {
    const fp = subjectsFingerprint([maths, art]);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(subjectsFingerprint([art, maths])).toBe(fp);
    expect(subjectsFingerprint([{ ...art, color: '#fff' } as typeof art, maths])).toBe(fp);
  });

  it('changes on rename, short change, add and remove', () => {
    const fp = subjectsFingerprint([maths, art]);
    const variants = [
      [{ ...maths, nameEn: 'Maths' }, art],
      [{ ...maths, nameSi: 'ගණිත' }, art],
      [{ ...maths, nameSi: undefined }, art],
      [maths, { ...art, short: 'Arts' }],
      [maths, art, { id: 's3', nameEn: 'Music', short: 'Mus' }],
      [maths],
      [],
    ];
    for (const v of variants) expect(subjectsFingerprint(v)).not.toBe(fp);
  });

  it('does not let field boundaries blur', () => {
    expect(subjectsFingerprint([{ id: 's1', nameEn: 'A', short: 'BC' }])).not.toBe(subjectsFingerprint([{ id: 's1', nameEn: 'AB', short: 'C' }]));
  });
});

describe('importFingerprint', () => {
  const file = {
    subjects: [{ row: 2, cells: { nameEn: 'Drama', short: 'Dra' } }],
    teachers: [{ row: 2, cells: { name: 'A', grades: '6' } }],
  };

  it('ignores cell key order and cell types', () => {
    const fp = importFingerprint(file);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(importFingerprint({ ...file, subjects: [{ row: 2, cells: { short: 'Dra', nameEn: 'Drama' } }] })).toBe(fp);
    expect(importFingerprint({ ...file, teachers: [{ row: 2, cells: { grades: '6', name: 'A' }, cellTypes: { grades: 'number' as const } }] })).toBe(fp);
  });

  it('changes with any cell, row number or sheet', () => {
    const fp = importFingerprint(file);
    for (const v of [
      { ...file, teachers: [{ row: 2, cells: { name: 'B', grades: '6' } }] },
      { ...file, teachers: [{ row: 3, cells: { name: 'A', grades: '6' } }] },
      { ...file, teachers: [...file.teachers, { row: 3, cells: { name: 'C' } }] },
      { subjects: [], teachers: file.teachers },
      { subjects: file.teachers, teachers: file.subjects },
    ]) {
      expect(importFingerprint(v)).not.toBe(fp);
    }
  });
});
