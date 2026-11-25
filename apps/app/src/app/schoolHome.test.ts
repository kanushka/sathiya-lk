// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Claims } from '@sathiya/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAST_SCHOOL_KEY, forgetLastSchool, homePath, markSchoolRemoved, readLastSchool, rememberLastSchool, schoolHomePath, unmarkSchoolRemoved } from './schoolHome';

const claims: Claims = { schools: { s1: { r: 't', t: 'T1' }, s2: { r: 'a' }, s3: { r: 't' } } };

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('schoolHomePath', () => {
  it('sends admins to the admin pages and teachers to their timetable', () => {
    expect(schoolHomePath(claims, 's1')).toBe('/s/s1/me');
    expect(schoolHomePath(claims, 's2')).toBe('/s/s2/admin');
  });

  it('has no home for a teacher membership without a teacher id or an unknown school', () => {
    expect(schoolHomePath(claims, 's3')).toBeNull();
    expect(schoolHomePath(claims, 'nope')).toBeNull();
  });
});

describe('homePath', () => {
  it('picks the last-used school while still a member', () => {
    expect(homePath(claims, 's2')).toBe('/s/s2/admin');
  });

  it('falls back to the first school when the last one is gone', () => {
    expect(homePath(claims, 'gone')).toBe('/s/s1/me');
    expect(homePath(claims, null)).toBe('/s/s1/me');
  });

  it('skips schools without a home', () => {
    expect(homePath({ schools: { s3: { r: 't' }, s2: { r: 'a' } } }, 's3')).toBe('/s/s2/admin');
  });

  it('sends super users without schools to /super and everyone else to /start', () => {
    expect(homePath({ super: true }, null)).toBe('/super');
    expect(homePath({}, null)).toBe('/start');
    expect(homePath({ schools: { s3: { r: 't' } } }, null)).toBe('/start');
  });
});

describe('last school memory', () => {
  it('stores and reads the last school', () => {
    rememberLastSchool('s9');
    expect(localStorage.getItem(LAST_SCHOOL_KEY)).toBe('s9');
    expect(readLastSchool()).toBe('s9');
  });

  it('survives storage errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberLastSchool('s1')).not.toThrow();
    expect(readLastSchool()).toBeNull();
  });
});

describe('removed schools', () => {
  afterEach(() => unmarkSchoolRemoved('s2'));

  it('skips a removed school still in stale claims, even when remembered', () => {
    rememberLastSchool('s2');
    markSchoolRemoved('s2');
    expect(readLastSchool()).toBeNull();
    expect(schoolHomePath(claims, 's2')).toBeNull();
    expect(homePath(claims, 's2')).toBe('/s/s1/me');
    expect(homePath({ schools: { s2: { r: 'a' } } }, 's2')).toBe('/start');
  });

  it('skips a remembered school whose claim is gone', () => {
    rememberLastSchool('gone');
    expect(homePath(claims, readLastSchool())).toBe('/s/s1/me');
  });

  it('forgets only the matching last school', () => {
    rememberLastSchool('s1');
    forgetLastSchool('s2');
    expect(readLastSchool()).toBe('s1');
    forgetLastSchool('s1');
    expect(readLastSchool()).toBeNull();
  });
});
