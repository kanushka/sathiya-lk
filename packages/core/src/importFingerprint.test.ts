// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { subjectsFingerprint } from './importFingerprint';

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
