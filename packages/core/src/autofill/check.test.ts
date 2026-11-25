// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, G, mahasen, S, T } from '../fixtures';
import type { DayIndex, EntryDraft, SchoolContext, Teacher } from '../types';
import { checkHard, type HardRule } from './check';
import { readyCtx } from './testCtx';

const d = (day: DayIndex, period: number, classId: string, subjectId: string, teacherId: string): EntryDraft => ({
  day,
  period,
  classIds: [classId],
  lessons: [{ subjectId, teacherId }],
});
const rules = (ctx: SchoolContext, drafts: EntryDraft[]): Array<[HardRule, number]> => checkHard(ctx, [], drafts).map((v) => [v.rule, v.draftIndex]);
const has = (ctx: SchoolContext, drafts: EntryDraft[], rule: HardRule, index: number): boolean => rules(ctx, drafts).some(([r, i]) => r === rule && i === index);
const withTeacher = (ctx: SchoolContext, id: string, patch: Partial<Teacher>): SchoolContext => ({ ...ctx, teachers: ctx.teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

const clean: EntryDraft[] = [
  d(0, 1, C.c6a, S.maths, T.bandara),
  d(0, 2, C.c6a, S.sinhala, T.ranasinghe),
  d(1, 1, C.c6a, S.maths, T.bandara),
];

describe('checkHard', () => {
  it('passes a clean draft set', () => {
    expect(rules(readyCtx, clean)).toEqual([]);
  });

  it('detects clashes against kept entries and other drafts', () => {
    const drafts = [...clean, d(0, 2, C.c6b, S.sinhala, T.ranasinghe)];
    expect(has(readyCtx, drafts, 'clash', 3)).toBe(true);
    const kept = [{ id: 'k', ...d(0, 3, C.c6a, S.english, T.wijesekara), teacherIds: [T.wijesekara] }];
    expect(checkHard(readyCtx, kept, [d(0, 3, C.c6a, S.science, T.gunasekara)]).map((v) => v.rule)).toContain('clash');
  });

  it('detects max-per-day on every non-exempt draft of that teacher/day', () => {
    const ctx = withTeacher(readyCtx, T.ranasinghe, { maxPerDay: 1 });
    const drafts = [d(0, 2, C.c6a, S.sinhala, T.ranasinghe), d(0, 3, C.c6a, S.sinhala, T.ranasinghe)];
    expect(has(ctx, drafts, 'max-per-day', 0)).toBe(true);
    expect(has(ctx, drafts, 'max-per-day', 1)).toBe(true);
  });

  it('exempts a classTeacherAll class teacher from max-per-day', () => {
    const ctx = withTeacher(readyCtx, T.wickramasinghe, { maxPerDay: 1 });
    const drafts = [d(0, 2, C.c1a, S.maths, T.wickramasinghe), d(0, 3, C.c1a, S.maths, T.wickramasinghe)];
    expect(rules(ctx, drafts).filter(([r]) => r === 'max-per-day')).toEqual([]);
  });

  it('detects over-target', () => {
    const drafts = [0, 1, 2].map((day) => d(day as DayIndex, 3, C.c6a, S.geography, T.herath));
    expect(has(readyCtx, drafts, 'over-target', 2)).toBe(true);
    expect(rules(readyCtx, drafts.slice(0, 2)).filter(([r]) => r === 'over-target')).toEqual([]);
  });

  it('detects first-slot not taken by the class teacher', () => {
    expect(has(readyCtx, [d(0, 1, C.c6a, S.sinhala, T.ranasinghe)], 'first-slot', 0)).toBe(true);
  });

  it('frees the first slot when the class teacher only teaches group options', () => {
    const grp: Teacher = { id: 't-grp', staffId: 'G1', name: 'Grp', isPrimary: false, subjectIds: [S.buddhism], grades: [6], maxPerDay: 7 };
    const ctx: SchoolContext = {
      ...readyCtx,
      teachers: [...readyCtx.teachers, grp],
      classes: readyCtx.classes.map((c) => (c.id === C.c6a ? { ...c, classTeacherId: grp.id } : c)),
    };
    expect(rules(ctx, [d(0, 1, C.c6a, S.sinhala, T.ranasinghe)]).filter(([r]) => r === 'first-slot')).toEqual([]);
  });

  it('detects a group in the first slot', () => {
    const g: EntryDraft = { day: 0, period: 1, classIds: [C.c6a, C.c6b], lessons: [{ subjectId: S.buddhism, teacherId: T.ananda }], groupKey: 'religion' };
    expect(has(readyCtx, [g], 'group-first', 0)).toBe(true);
  });

  it('detects staffing violations in each mode', () => {
    expect(has(readyCtx, [d(0, 2, C.c1a, S.maths, T.kumari)], 'staffing', 0)).toBe(true);

    const plus: SchoolContext = { ...readyCtx, grades: readyCtx.grades.map((g) => (g.id === G.g6 ? { ...g, staffing: { mode: 'classTeacherPlusSpecialists' as const, specialistSubjectIds: [S.english] } } : g)) };
    expect(has(plus, [d(0, 2, C.c6a, S.english, T.bandara)], 'staffing', 0)).toBe(true);
    expect(has(plus, [d(0, 2, C.c6a, S.science, T.gunasekara)], 'staffing', 0)).toBe(true);
    expect(rules(plus, [d(0, 2, C.c6a, S.english, T.wijesekara), d(0, 3, C.c6a, S.maths, T.bandara)]).filter(([r]) => r === 'staffing')).toEqual([]);

    const three = [d(0, 2, C.c6a, S.sinhala, T.rSilva), d(1, 2, C.c6a, S.history, T.rSilva), d(2, 2, C.c6a, S.geography, T.rSilva)];
    expect(rules(readyCtx, three).filter(([r]) => r === 'staffing').map(([, i]) => i)).toEqual([0, 1, 2]);
  });

  it('detects periods outside the class template', () => {
    expect(has(readyCtx, [d(0, 9, C.c6a, S.maths, T.bandara)], 'off-template', 0)).toBe(true);
    expect(has(readyCtx, [d(4, 8, C.c6c, S.maths, T.bandara)], 'off-template', 0)).toBe(true);
  });

  describe('minutes items (mahasen)', () => {
    const { ctx, S: M } = mahasen;
    const cls = 'mh-c-1a';
    const ct = 'mh-t-1a';

    it('accepts a perDay item filled by exact slots', () => {
      expect(rules(ctx, [d(0, 4, cls, M.english, ct)])).toEqual([]);
    });

    it('detects per-day mismatch from slot length', () => {
      expect(has(ctx, [d(0, 3, cls, M.english, ct)], 'per-day', 0)).toBe(true);
    });

    it('counts activity credit toward perDay', () => {
      expect(has(ctx, [d(0, 4, cls, M.health, ct)], 'per-day', 0)).toBe(true);
    });

    it('detects over-target in minutes', () => {
      const days: DayIndex[] = [0, 1, 2, 3, 4];
      const drafts = [...days.map((day) => d(day, 2, cls, M.coCurricular, ct)), d(0, 3, cls, M.coCurricular, ct)];
      expect(rules(ctx, drafts).some(([r]) => r === 'over-target')).toBe(true);
    });
  });
});
