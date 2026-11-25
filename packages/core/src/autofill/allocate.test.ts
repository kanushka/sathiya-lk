// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, entries as fixtureEntries, entry, G, S, T } from '../fixtures';
import type { PlanItem, SchoolContext, Teacher } from '../types';
import { allocate, type Allocation } from './allocate';
import { rng } from './rng';
import { readyCtx } from './testCtx';

const run = (ctx: SchoolContext, classIds: string[], extra: Partial<Parameters<typeof allocate>[0]> = {}, seed = 1) =>
  allocate({ ctx, entries: [], classIds, random: rng(seed), ...extra });
const teacherFor = (rows: Allocation[], classId: string, planKey: string, subjectId?: string): string | null | undefined =>
  rows.find((r) => r.classId === classId && r.planKey === planKey && (subjectId === undefined || r.subjectId === subjectId))?.teacherId;
const withGrade = (ctx: SchoolContext, id: string, patch: Partial<SchoolContext['grades'][number]>): SchoolContext => ({ ...ctx, grades: ctx.grades.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
const teacher = (id: string, subjectIds: string[], extra: Partial<Teacher> = {}): Teacher => ({ id, staffId: id, name: id, isPrimary: false, subjectIds, grades: [6], maxPerDay: 7, ...extra });
const subj = (subjectId: string, perWeek: number): PlanItem => ({ kind: 'subject', subjectId, perWeek });

describe('allocate', () => {
  it('classTeacherAll gives everything to the class teacher', () => {
    const { allocation } = run(readyCtx, [C.c1a]);
    const subjects = allocation.filter((r) => r.planKey.startsWith('subject:'));
    expect(subjects.length).toBe(7);
    expect(subjects.every((r) => r.teacherId === T.wickramasinghe)).toBe(true);
  });

  it('specialist English goes to another teacher', () => {
    const ctx = withGrade(readyCtx, G.g6, { staffing: { mode: 'classTeacherPlusSpecialists', specialistSubjectIds: [S.english] } });
    const { allocation } = run(ctx, [C.c6a]);
    const english = teacherFor(allocation, C.c6a, `subject:${S.english}`);
    expect(english).not.toBe(T.bandara);
    expect([T.wijesekara, T.rizan]).toContain(english);
    expect(teacherFor(allocation, C.c6a, `subject:${S.maths}`)).toBe(T.bandara);
    expect(teacherFor(allocation, C.c6a, `subject:${S.science}`)).toBe(T.bandara);
  });

  it('caps a teacher at two subjects per class', () => {
    const plan = [subj(S.maths, 5), subj(S.science, 2), subj(S.sinhala, 2), subj(S.history, 2)];
    const all = [S.maths, S.science, S.sinhala, S.history];
    const ctx: SchoolContext = {
      ...withGrade(readyCtx, G.g6, { plan }),
      teachers: [teacher('ta', all), teacher('tb', all)],
      classes: readyCtx.classes.map((c) => (c.id === C.c6a ? { ...c, classTeacherId: 'ta' } : c)),
    };
    const { allocation, problems } = run(ctx, [C.c6a]);
    expect(problems).toEqual([]);
    for (const id of ['ta', 'tb']) expect(allocation.filter((r) => r.teacherId === id).length).toBe(2);
  });

  it('class teacher gets a daily subject in subjectTeachers mode', () => {
    for (const seed of [1, 2, 3, 4]) {
      const { allocation, problems } = run(readyCtx, [C.c6a], {}, seed);
      expect(teacherFor(allocation, C.c6a, `subject:${S.maths}`)).toBe(T.bandara);
      expect(problems.filter((p) => p.reason === 'class-teacher-no-daily-subject')).toEqual([]);
    }
  });

  it('reports a class teacher with no daily subject, but not one qualified only for a group option', () => {
    const noDaily: SchoolContext = { ...readyCtx, classes: readyCtx.classes.map((c) => (c.id === C.c6a ? { ...c, classTeacherId: T.kumara } : c)) };
    expect(run(noDaily, [C.c6a]).problems.map((p) => [p.classId, p.reason])).toContainEqual([C.c6a, 'class-teacher-no-daily-subject']);
    expect(run(readyCtx, [C.c6c]).problems.filter((p) => p.reason === 'class-teacher-no-daily-subject')).toEqual([]);
  });

  it('keeps teacher already used in kept entries', () => {
    const { allocation } = run(readyCtx, [C.c6b], { entries: fixtureEntries });
    expect(teacherFor(allocation, C.c6b, `subject:${S.sinhala}`)).toBe(T.rSilva);
    expect(teacherFor(allocation, C.c6b, `subject:${S.science}`)).toBe(T.gunasekara);
    expect(teacherFor(allocation, C.c6b, `subject:${S.english}`)).toBe(T.wijesekara);
  });

  it('overrides win', () => {
    const overrides: Allocation[] = [
      { classId: C.c6a, planKey: `subject:${S.english}`, subjectId: S.english, teacherId: T.rizan },
      { classId: C.c6a, planKey: 'group:religion', subjectId: S.buddhism, teacherId: T.rajan },
    ];
    const { allocation } = run(readyCtx, [C.c6a], { overrides });
    expect(teacherFor(allocation, C.c6a, `subject:${S.english}`)).toBe(T.rizan);
    expect(teacherFor(allocation, C.c6a, 'group:religion', S.buddhism)).toBe(T.rajan);
  });

  it('group block gets one teacher per option across classes', () => {
    const { allocation } = run(readyCtx, [C.c6a, C.c6b]);
    const options = [S.buddhism, S.catholicism, S.islam];
    const teachers = options.map((s) => teacherFor(allocation, C.c6a, 'group:religion', s));
    expect(new Set(teachers).size).toBe(3);
    expect(teachers).not.toContain(null);
    options.forEach((s, i) => expect(teacherFor(allocation, C.c6b, 'group:religion', s)).toBe(teachers[i]));
    expect(allocation.filter((r) => r.planKey === 'group:religion').length).toBe(6);
  });

  it('spreads load across equally qualified teachers', () => {
    const ctx: SchoolContext = {
      ...withGrade(readyCtx, G.g6, { plan: [subj(S.science, 4)] }),
      teachers: [teacher('ta', [S.science]), teacher('tb', [S.science]), teacher('tc', [S.history])],
      classes: readyCtx.classes.map((c) => ({ ...c, classTeacherId: 'tc' })),
    };
    const { allocation } = run(ctx, [C.c6a, C.c6b]);
    expect(new Set(allocation.filter((r) => r.subjectId === S.science).map((r) => r.teacherId)).size).toBe(2);
  });

  it('reports a subject nobody teaches', () => {
    const ctx: SchoolContext = { ...withGrade(readyCtx, G.g6, { plan: [subj(S.science, 2)] }), teachers: [teacher('tc', [S.history])] };
    const { allocation, problems } = run(ctx, [C.c6a]);
    expect(teacherFor(allocation, C.c6a, `subject:${S.science}`)).toBeNull();
    expect(problems).toContainEqual({ classId: C.c6a, planKey: `subject:${S.science}`, reason: 'no-qualified-teacher' });
  });

  it('returns null with subject-cap when every qualified teacher holds two subjects', () => {
    const all = [S.maths, S.science, S.sinhala];
    const ctx: SchoolContext = {
      ...withGrade(readyCtx, G.g6, { plan: [subj(S.maths, 2), subj(S.science, 2), subj(S.sinhala, 2)] }),
      teachers: [teacher('ta', all), teacher('tc', [S.history])],
      classes: readyCtx.classes.map((c) => (c.id === C.c6a ? { ...c, classTeacherId: 'tc' } : c)),
    };
    const { allocation, problems } = run(ctx, [C.c6a]);
    expect(allocation.filter((r) => r.teacherId === 'ta').length).toBe(2);
    expect(allocation.filter((r) => r.teacherId === null).length).toBe(1);
    expect(problems.filter((p) => p.reason === 'subject-cap').length).toBe(1);
  });

  it('kept-entry teacher keeps preference but not past the cap', () => {
    const all = [S.maths, S.science, S.sinhala];
    const ctx: SchoolContext = {
      ...withGrade(readyCtx, G.g6, { plan: [subj(S.maths, 2), subj(S.science, 2), subj(S.sinhala, 2)] }),
      teachers: [teacher('ta', all), teacher('tb', all), teacher('tc', [S.history])],
      classes: readyCtx.classes.map((c) => (c.id === C.c6a ? { ...c, classTeacherId: 'tc' } : c)),
    };
    const kept = [entry('k1', 0, 1, [C.c6a], [[S.maths, 'ta']]), entry('k2', 0, 2, [C.c6a], [[S.science, 'ta']])];
    const { allocation } = run(ctx, [C.c6a], { entries: kept });
    expect(teacherFor(allocation, C.c6a, `subject:${S.maths}`)).toBe('ta');
    expect(teacherFor(allocation, C.c6a, `subject:${S.sinhala}`)).toBe('tb');
  });

  it('is deterministic for the same seed', () => {
    const a = run(readyCtx, [C.c6a, C.c6b, C.c6c], {}, 7);
    const b = run(readyCtx, [C.c6a, C.c6b, C.c6c], {}, 7);
    expect(a).toEqual(b);
  });

  it('only allocates requested classes', () => {
    const { allocation } = run(readyCtx, [C.c6a]);
    expect(new Set(allocation.map((r) => r.classId))).toEqual(new Set([C.c6a]));
  });
});
