// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ addDoc: vi.fn(), collection: vi.fn(), deleteField: vi.fn(), doc: vi.fn(), updateDoc: vi.fn() }));

import { cleanPlan, cleanStaffing } from './api';

describe('cleanPlan', () => {
  it('keeps unit and perDay on subjects and groups', () => {
    expect(
      cleanPlan([
        { kind: 'subject', subjectId: 's1', perWeek: 50, unit: 'minutes', perDay: 10 },
        { kind: 'subject', subjectId: 's2', perWeek: 4 },
        { kind: 'group', key: 'g', nameEn: ' G ', optionSubjectIds: ['a'], perWeek: 60, unit: 'minutes' },
      ]),
    ).toEqual([
      { kind: 'subject', subjectId: 's1', perWeek: 50, unit: 'minutes', perDay: 10 },
      { kind: 'subject', subjectId: 's2', perWeek: 4 },
      { kind: 'group', key: 'g', nameEn: 'G', optionSubjectIds: ['a'], perWeek: 60, unit: 'minutes' },
    ]);
  });
});

describe('cleanStaffing', () => {
  it('keeps specialists only for class teacher plus specialists', () => {
    expect(cleanStaffing({ mode: 'subjectTeachers', specialistSubjectIds: ['x'] })).toEqual({ mode: 'subjectTeachers' });
    expect(cleanStaffing({ mode: 'classTeacherPlusSpecialists', specialistSubjectIds: ['x'] })).toEqual({ mode: 'classTeacherPlusSpecialists', specialistSubjectIds: ['x'] });
    expect(cleanStaffing({ mode: 'classTeacherPlusSpecialists' })).toEqual({ mode: 'classTeacherPlusSpecialists', specialistSubjectIds: [] });
  });
});
