// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { censusError, emptySchool, schoolOk, type SchoolDraft } from './model';

const base: SchoolDraft = { ...emptySchool, nameEn: 'A', district: 'K', city: 'K', staffPrefix: 'SCC' };

describe('census rules', () => {
  it('requires 4-6 digits for government', () => {
    expect(schoolOk({ ...base, type: 'government', censusNo: '' })).toBe(false);
    expect(schoolOk({ ...base, type: 'government', censusNo: '123' })).toBe(false);
    expect(schoolOk({ ...base, type: 'government', censusNo: '1234567' })).toBe(false);
    expect(schoolOk({ ...base, type: 'government', censusNo: '03214' })).toBe(true);
  });

  it('lets private schools tick no census number', () => {
    expect(schoolOk({ ...base, type: 'private', censusNo: '', noCensus: true })).toBe(true);
    expect(schoolOk({ ...base, type: 'private', censusNo: '', noCensus: false })).toBe(false);
    expect(schoolOk({ ...base, type: 'international', censusNo: '1234', noCensus: false })).toBe(true);
  });

  it('flags a non-digit or wrong-length entry only once something is typed', () => {
    expect(censusError({ ...base, censusNo: '' })).toBeNull();
    expect(censusError({ ...base, censusNo: '12' })).toBe('format');
    expect(censusError({ ...base, censusNo: '12a45' })).toBe('format');
    expect(censusError({ ...base, censusNo: '12345' })).toBeNull();
  });
});
