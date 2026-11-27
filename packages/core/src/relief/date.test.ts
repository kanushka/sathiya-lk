// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { addDays, addSchoolDays, colomboToday, nextSchoolDay, schoolDayOf } from './date';

describe('colomboToday', () => {
  it('maps a weekday instant to Colombo date and day', () => {
    expect(colomboToday(new Date('2026-11-24T02:00:00Z'))).toEqual({ date: '2026-11-24', day: 1 });
  });
  it('rolls over to the next Colombo date after 18:30Z', () => {
    expect(colomboToday(new Date('2026-11-23T19:00:00Z'))).toEqual({ date: '2026-11-24', day: 1 });
  });
  it('returns null day on weekends', () => {
    expect(colomboToday(new Date('2026-11-21T20:00:00Z'))).toEqual({ date: '2026-11-22', day: null });
    expect(colomboToday(new Date('2026-11-21T02:00:00Z'))).toEqual({ date: '2026-11-21', day: null });
  });
});

describe('school day stepping', () => {
  it('adds calendar days across a month end', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('names the school day of a date', () => {
    expect(schoolDayOf('2026-03-04')).toBe(2);
    expect(schoolDayOf('2026-03-07')).toBeNull();
  });
  it('skips weekends in both directions', () => {
    expect(addSchoolDays('2026-03-06', 1)).toEqual({ date: '2026-03-09', day: 0 });
    expect(addSchoolDays('2026-03-09', -1)).toEqual({ date: '2026-03-06', day: 4 });
    expect(addSchoolDays('2026-03-04', 3)).toEqual({ date: '2026-03-09', day: 0 });
    expect(addSchoolDays('2026-03-07', 0)).toEqual({ date: '2026-03-09', day: 0 });
  });
  it('gives tomorrow, or Monday from Friday to Sunday', () => {
    expect(nextSchoolDay(new Date('2026-03-04T03:50:00Z'))).toEqual({ date: '2026-03-05', day: 3 });
    expect(nextSchoolDay(new Date('2026-03-06T03:50:00Z'))).toEqual({ date: '2026-03-09', day: 0 });
    expect(nextSchoolDay(new Date('2026-03-08T03:50:00Z'))).toEqual({ date: '2026-03-09', day: 0 });
  });
});
