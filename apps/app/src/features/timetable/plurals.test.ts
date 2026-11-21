// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { createI18n } from '@sathiya/i18n';
import { describe, expect, it } from 'vitest';

describe('timetable plural labels', () => {
  const en = createI18n('en');
  const t = (key: string, opts: Record<string, unknown>) => en.t(`timetable:${key}`, opts);

  it('uses singular and plural forms in English', () => {
    expect(t('teacherView.week', { count: 1 })).toBe('1 period this week');
    expect(t('teacherView.week', { count: 3 })).toBe('3 periods this week');
    expect(t('cell.groupTeachers', { count: 1 })).toBe('Group · 1 teacher');
    expect(t('cell.groupTeachers', { count: 3 })).toBe('Group · 3 teachers');
    expect(t('fill.confirm', { count: 1 })).toBe('Fill 1 period');
    expect(t('fill.confirm', { count: 4 })).toBe('Fill 4 periods');
    expect(t('fill.body', { count: 1, teacher: 'X' })).toMatch(/^1 empty period will be filled with X/);
    expect(t('fill.body', { count: 4, teacher: 'X' })).toMatch(/^4 empty periods will be filled with X/);
  });

  it('resolves Sinhala plural forms without falling back to English', () => {
    const si = createI18n('si');
    for (const count of [1, 3]) {
      expect(si.t('timetable:teacherView.week', { count })).toBe(`මෙම සතියේ කාලච්ඡේද ${count}`);
      expect(si.t('timetable:cell.groupTeachers', { count })).toBe(`කණ්ඩායම · ගුරුවරු ${count}`);
      expect(si.t('timetable:fill.confirm', { count })).toBe(`කාලච්ඡේද ${count}ක් පුරවන්න`);
    }
  });
});
