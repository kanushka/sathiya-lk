// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { ctx, S } from './fixtures';
import { defaultSpecialistIds, isMinutes, staffingFor } from './staffing';
import type { Grade } from './types';

const grade = (number: number, staffing?: Grade['staffing']): Grade => ({ id: `g-${number}`, number, plan: [], staffing });

describe('defaultSpecialistIds', () => {
  it('is the English subjects of the school', () => {
    expect(defaultSpecialistIds(ctx)).toEqual([S.english]);
  });
});

describe('staffingFor', () => {
  it('defaults Grades 1–2 to classTeacherAll', () => {
    for (const n of [1, 2]) {
      expect(staffingFor(grade(n), ctx)).toEqual({ mode: 'classTeacherAll', specialistSubjectIds: [] });
    }
  });

  it('defaults Grades 3–5 to classTeacherPlusSpecialists with English', () => {
    for (const n of [3, 4, 5]) {
      expect(staffingFor(grade(n), ctx)).toEqual({ mode: 'classTeacherPlusSpecialists', specialistSubjectIds: [S.english] });
    }
  });

  it('detects a Sinhala-only English subject', () => {
    const c = { ...ctx, subjects: [{ id: 'x', nameEn: '', nameSi: 'ඉංග්‍රිසි', short: 'X', color: '#fff' }] };
    expect(staffingFor(grade(4), c).specialistSubjectIds).toEqual(['x']);
  });

  it('does not detect Literature as English', () => {
    const c = { ...ctx, subjects: [{ id: 'l', nameEn: 'Literature', short: 'L', color: '#fff' }, { id: 'm', nameEn: 'Mathematics', short: 'M', color: '#fff' }] };
    expect(staffingFor(grade(4), c).specialistSubjectIds).toEqual([]);
  });

  it('defaults Grade 6+ to subjectTeachers', () => {
    expect(staffingFor(grade(6), ctx)).toEqual({ mode: 'subjectTeachers', specialistSubjectIds: [] });
    expect(staffingFor(grade(11), ctx).mode).toBe('subjectTeachers');
  });

  it('uses grade.staffing when set', () => {
    expect(staffingFor(grade(1, { mode: 'subjectTeachers' }), ctx)).toEqual({ mode: 'subjectTeachers', specialistSubjectIds: [] });
    expect(staffingFor(grade(6, { mode: 'classTeacherPlusSpecialists', specialistSubjectIds: ['a'] }), ctx)).toEqual({
      mode: 'classTeacherPlusSpecialists',
      specialistSubjectIds: ['a'],
    });
  });
});

describe('isMinutes', () => {
  it('is true only for unit minutes', () => {
    expect(isMinutes({ kind: 'subject', subjectId: 's', perWeek: 60, unit: 'minutes' })).toBe(true);
    expect(isMinutes({ kind: 'subject', subjectId: 's', perWeek: 3 })).toBe(false);
  });
});
