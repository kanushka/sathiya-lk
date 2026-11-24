// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, expectTypeOf, it } from 'vitest';
import { callables, type ApiErrorCode, type CallableTypes, type RegisterSchoolReq, type ReportSchoolReq } from './api';
import { CENSUS_NO_LENGTH, CENSUS_NO_RE, censusRequired, normalizeCensusNo } from './census';
import { school } from './fixtures';
import { paths } from './paths';
import { AUTH_EMAIL_KINDS, REPORT_REASONS, SCHOOL_TYPES, type School, type SchoolReport } from './types';

describe('normalizeCensusNo', () => {
  it('strips spaces and leading/trailing junk', () => {
    expect(normalizeCensusNo(' 12 345 ')).toBe('12345');
    expect(normalizeCensusNo('#1234.')).toBe('1234');
    expect(normalizeCensusNo('(01234)')).toBe('01234');
  });

  it('returns null unless digits only', () => {
    expect(normalizeCensusNo('12a45')).toBeNull();
    expect(normalizeCensusNo('abc1234')).toBeNull();
    expect(normalizeCensusNo('12-345')).toBeNull();
    expect(normalizeCensusNo('')).toBeNull();
    expect(normalizeCensusNo('  ')).toBeNull();
  });

  it('enforces CENSUS_NO_LENGTH bounds', () => {
    expect(CENSUS_NO_LENGTH).toEqual({ min: 4, max: 6 });
    expect(normalizeCensusNo('1'.repeat(CENSUS_NO_LENGTH.min - 1))).toBeNull();
    expect(normalizeCensusNo('1'.repeat(CENSUS_NO_LENGTH.min))).toBe('1111');
    expect(normalizeCensusNo('1'.repeat(CENSUS_NO_LENGTH.max))).toBe('111111');
    expect(normalizeCensusNo('1'.repeat(CENSUS_NO_LENGTH.max + 1))).toBeNull();
  });
});

describe('censusRequired', () => {
  it('is true only for government schools', () => {
    expect(censusRequired('government')).toBe(true);
    expect(censusRequired('private')).toBe(false);
    expect(censusRequired('international')).toBe(false);
  });
});

describe('school type and census number', () => {
  it('types', () => {
    expectTypeOf<School['type']>().toEqualTypeOf<'government' | 'private' | 'international'>();
    expectTypeOf<School['censusNo']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<RegisterSchoolReq['school']['type']>().toEqualTypeOf<School['type']>();
    expectTypeOf<RegisterSchoolReq['school']['censusNo']>().toEqualTypeOf<string | undefined>();
  });

  it('fixture school is a government school with a census number', () => {
    expect(school.type).toBe('government');
    expect(normalizeCensusNo(school.censusNo ?? '')).toBe(school.censusNo);
  });
});

describe('reports and census paths', () => {
  it('builds paths', () => {
    expect(paths.censusIndex('12345')).toBe('censusIndex/12345');
    expect(paths.reports()).toBe('reports');
    expect(paths.report('r1')).toBe('reports/r1');
  });

  it('reportSchool callable and types', () => {
    expect(callables.reportSchool).toBe('reportSchool');
    expectTypeOf<CallableTypes['reportSchool']['req']>().toEqualTypeOf<ReportSchoolReq>();
    expectTypeOf<CallableTypes['reportSchool']['res']>().toEqualTypeOf<{ ok: true }>();
    expectTypeOf<ReportSchoolReq>().toEqualTypeOf<{ schoolId: string; reason: 'fake' | 'duplicate' | 'abuse' | 'other'; details?: string; email?: string }>();
    expectTypeOf<SchoolReport['status']>().toEqualTypeOf<'open' | 'closed'>();
    expectTypeOf<SchoolReport['reason']>().toEqualTypeOf<ReportSchoolReq['reason']>();
    expectTypeOf<SchoolReport>().toHaveProperty('createdAt').toEqualTypeOf<number>();
  });

  it('new error codes', () => {
    expectTypeOf<'school-registered' | 'email-unverified' | 'rate-limited'>().toMatchTypeOf<ApiErrorCode>();
    expectTypeOf<'census-taken'>().not.toMatchTypeOf<ApiErrorCode>();
    expectTypeOf<'already-has-school'>().not.toMatchTypeOf<ApiErrorCode>();
  });
});

describe('contract constants', () => {
  it('CENSUS_NO_RE accepts exactly 4-6 digits', () => {
    expect(CENSUS_NO_RE.test('1234')).toBe(true);
    expect(CENSUS_NO_RE.test('123456')).toBe(true);
    expect(CENSUS_NO_RE.test('123')).toBe(false);
    expect(CENSUS_NO_RE.test('1234567')).toBe(false);
    expect(CENSUS_NO_RE.test('12a45')).toBe(false);
  });

  it('exposes runtime lists matching the union types', () => {
    expect(SCHOOL_TYPES).toEqual(['government', 'private', 'international']);
    expect(REPORT_REASONS).toEqual(['fake', 'duplicate', 'abuse', 'other']);
    expect(AUTH_EMAIL_KINDS).toEqual(['verify', 'reset']);
  });
});
