// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { isSchoolAdmin, membershipOf, schoolIds, teacherIdOf } from './membership';
import type { Claims } from './types';

const claims: Claims = { schools: { s1: { r: 'a', t: 'T1' }, s2: { r: 't', t: 'T2' }, s3: { r: 'a' } } };

describe('membership helpers', () => {
  it('membershipOf handles missing map and sid', () => {
    expect(membershipOf({}, 's1')).toBeUndefined();
    expect(membershipOf(claims, 'nope')).toBeUndefined();
    expect(membershipOf(claims, 's2')).toEqual({ r: 't', t: 'T2' });
  });
  it('isSchoolAdmin true only for r:a', () => {
    expect(isSchoolAdmin(claims, 's1')).toBe(true);
    expect(isSchoolAdmin(claims, 's2')).toBe(false);
    expect(isSchoolAdmin(claims, 'nope')).toBe(false);
    expect(isSchoolAdmin({}, 's1')).toBe(false);
  });
  it('teacherIdOf returns linked teacher incl. for admin', () => {
    expect(teacherIdOf(claims, 's1')).toBe('T1');
    expect(teacherIdOf(claims, 's2')).toBe('T2');
    expect(teacherIdOf(claims, 's3')).toBeUndefined();
    expect(teacherIdOf({}, 's1')).toBeUndefined();
  });
  it('schoolIds lists keys', () => {
    expect(schoolIds(claims)).toEqual(['s1', 's2', 's3']);
    expect(schoolIds({})).toEqual([]);
  });
});
