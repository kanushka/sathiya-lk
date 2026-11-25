// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, ctx as fixtureCtx, G, mahasen, S, T, TPL } from './fixtures';
import { readiness, type ReadinessCode } from './readiness';
import type { Grade, PeriodTemplate, PlanItem, SchoolClass, SchoolContext, Teacher } from './types';

const senior: Teacher = { id: 't-senior', staffId: 'SCC900', name: 'Senior', isPrimary: false, subjectIds: [S.sinhala, S.history, S.geography, S.english], grades: [12], maxPerDay: 7 };
const g6Source = fixtureCtx.grades.find((g) => g.id === G.g6)!.plan;
// Siripura fixture is a partial school; this makes it fully ready without changing the shared fixture.
const ctx: SchoolContext = {
  ...fixtureCtx,
  school: { ...fixtureCtx.school, grades: [1, 6, 12] },
  teachers: [...fixtureCtx.teachers, senior],
  classes: fixtureCtx.classes.map((c) =>
    c.id === C.c6c ? { ...c, classTeacherId: T.gunasekara, planOverride: g6Source.map((i) => (i.kind === 'subject' && i.subjectId === S.pts ? { ...i, perWeek: 1 } : i)) } : c,
  ),
};

const codes = (c: SchoolContext, list: 'blocking' | 'warnings' = 'blocking'): ReadinessCode[] => readiness(c, [])[list].map((i) => i.code);
const find = (c: SchoolContext, code: ReadinessCode) => [...readiness(c, []).blocking, ...readiness(c, []).warnings].filter((i) => i.code === code);

const withGrade = (id: string, patch: Partial<Grade>, base: SchoolContext = ctx): SchoolContext => ({ ...base, grades: base.grades.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
const withClass = (id: string, patch: Partial<SchoolClass>, base: SchoolContext = ctx): SchoolContext => ({ ...base, classes: base.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
const withTeacher = (id: string, patch: Partial<Teacher>, base: SchoolContext = ctx): SchoolContext => ({ ...base, teachers: base.teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
const withoutTeachersFor = (subjectId: string, base: SchoolContext = ctx): SchoolContext => ({
  ...base,
  teachers: base.teachers.map((t) => ({ ...t, subjectIds: t.subjectIds.filter((s) => s !== subjectId) })),
});
const withPlan6 = (plan: PlanItem[]): SchoolContext => withGrade(G.g6, { plan });
const g6Plan = ctx.grades.find((g) => g.id === G.g6)!.plan;

describe('readiness', () => {
  it('fixture schools are ready (Siripura completed with a Grade 12 teacher and a fitting 6C)', () => {
    expect(readiness(ctx, []).blocking).toEqual([]);
    expect(readiness(mahasen.ctx, []).blocking).toEqual([]);
  });

  it('blocks a grade with no class', () => {
    const c: SchoolContext = { ...ctx, classes: ctx.classes.filter((k) => k.gradeId !== G.g12) };
    expect(find(c, 'grade-no-classes')[0]?.ref).toEqual({ kind: 'grade', id: G.g12 });
  });

  it('blocks a grade number with no grade doc', () => {
    const c: SchoolContext = { ...ctx, school: { ...ctx.school, grades: [...ctx.school.grades, 7] } };
    expect(find(c, 'grade-no-classes')[0]?.ref).toEqual({ kind: 'grade', id: '7' });
  });

  it('blocks a class without a class teacher', () => {
    expect(find(withClass(C.c6a, { classTeacherId: undefined }), 'class-no-teacher')[0]?.ref).toEqual({ kind: 'class', id: C.c6a });
  });

  it('blocks a class without a template', () => {
    expect(find(withClass(C.c6a, { templateId: 'gone' }), 'class-no-template')[0]?.ref).toEqual({ kind: 'class', id: C.c6a });
  });

  it('blocks an empty plan', () => {
    expect(codes(withGrade(G.g6, { plan: [] }))).toContain('plan-empty');
  });

  it('blocks a plan item with zero target', () => {
    const plan: PlanItem[] = g6Plan.map((i) => (i.kind === 'subject' && i.subjectId === S.pts ? { ...i, perWeek: 0 } : i));
    expect(find(withPlan6(plan), 'plan-zero-target')[0]?.params).toEqual({ classId: C.c6a, planKey: `subject:${S.pts}` });
  });

  it('blocks a teacher with no subjects unless primary', () => {
    expect(find(withTeacher(T.bandara, { subjectIds: [] }), 'teacher-no-subjects')[0]?.ref).toEqual({ kind: 'teacher', id: T.bandara });
    expect(codes(withTeacher(T.wickramasinghe, { subjectIds: [] }))).not.toContain('teacher-no-subjects');
  });

  it('blocks a teacher with no grades', () => {
    expect(find(withTeacher(T.rajan, { grades: [] }), 'teacher-no-grades')[0]?.ref.id).toBe(T.rajan);
  });

  it('blocks a teacher with no daily maximum', () => {
    expect(find(withTeacher(T.rajan, { maxPerDay: 0 }), 'teacher-no-max')[0]?.ref.id).toBe(T.rajan);
  });

  it('blocks a plan that exceeds the template periods', () => {
    const plan = g6Plan.map((i) => (i.kind === 'subject' && i.subjectId === S.maths ? { ...i, perWeek: 7 } : i));
    expect(find(withPlan6(plan), 'plan-exceeds-template')[0]?.params).toEqual({ classId: C.c6a, unit: 'periods', needed: 41, available: 40 });
  });

  it('blocks a minutes plan that exceeds the template minutes', () => {
    const g = mahasen.ctx.grades[0]!;
    const plan = g.plan.map((i) => (i.kind === 'subject' && i.subjectId === mahasen.S.maths ? { ...i, perWeek: 2000 } : i));
    const issue = find(withGrade(g.id, { plan }, mahasen.ctx), 'plan-exceeds-template')[0];
    expect(issue?.params).toMatchObject({ unit: 'minutes', available: 1000 });
  });

  it('blocks per-day minutes that a day cannot hold', () => {
    const t = mahasen.ctx.templates[0]!;
    const friday = t.rows.filter((r) => r.type !== 'period' || r.start === '08:15' || r.start === '09:30');
    const days = { 0: t.rows, 1: t.rows, 2: t.rows, 3: t.rows, 4: friday.map((r) => (r.type === 'period' && r.start === '08:15' ? { ...r, end: '08:45' } : r)).filter((r) => r.type !== 'period' || r.start === '08:15') };
    const template: PeriodTemplate = { ...t, mode: 'perDay', days };
    const g = mahasen.ctx.grades[0]!;
    const plan = g.plan.map((i) => (i.kind === 'subject' && i.subjectId === mahasen.S.english ? { ...i, perDay: 10 } : i));
    const c = withGrade(g.id, { plan }, { ...mahasen.ctx, templates: [template] });
    const issue = find(c, 'per-day-unbuildable').find((i) => i.params.day === 4);
    expect(issue?.params).toEqual({ classId: 'mh-c-1a', planKey: `subject:${mahasen.S.english}`, day: 4, minutes: 10 });
  });

  it('blocks a subject-teacher subject with no qualified teacher', () => {
    const issue = find(withoutTeachersFor(S.geography), 'no-qualified-teacher').find((i) => i.params.classId === C.c6a);
    expect(issue?.params).toEqual({ classId: C.c6a, subjectId: S.geography });
  });

  it('blocks a group option with no qualified teacher', () => {
    expect(find(withoutTeachersFor(S.islam), 'no-qualified-teacher').some((i) => i.params.subjectId === S.islam)).toBe(true);
  });

  it('does not need qualified teachers for class-teacher subjects in Grades 1–2', () => {
    expect(find(withoutTeachersFor(S.tamil), 'no-qualified-teacher').some((i) => i.params.classId === C.c1a)).toBe(false);
  });

  it('blocks a specialist subject with only the class teacher qualified', () => {
    const c = withGrade(G.g1, { number: 3 });
    const staffed = withTeacher(T.wijesekara, { grades: [3] }, c);
    expect(codes(staffed)).not.toContain('no-specialist');
    expect(find(c, 'no-specialist')[0]?.params).toEqual({ classId: C.c1a, subjectId: S.english });
  });

  it('blocks a subject-teacher class whose class teacher has no daily subject', () => {
    expect(find(withClass(C.c6a, { classTeacherId: T.rajan }), 'class-teacher-no-daily-subject')[0]?.ref).toEqual({ kind: 'class', id: C.c6a });
  });

  it('warns when teacher capacity is below demand', () => {
    const c = withTeacher(T.herath, { maxPerDay: 1 }, withTeacher(senior.id, { subjectIds: [S.sinhala, S.history, S.english] }));
    const w = find(c, 'capacity-short').find((i) => i.params.subjectId === S.geography);
    expect(w?.params).toEqual({ subjectId: S.geography, needed: 10, capacity: 5 });
    expect(codes(c, 'warnings')).toContain('capacity-short');
    expect(codes(c)).not.toContain('capacity-short');
  });

  it('warns when minimum weekly loads cannot be reached', () => {
    const c = withTeacher(T.herath, { minPerWeek: 10_000 });
    expect(codes(c, 'warnings')).toEqual(['min-per-week-unreachable']);
    expect(find(c, 'min-per-week-unreachable')[0]?.params.needed).toBe(10_000);
  });

  it('counts a shared group block once for capacity', () => {
    const base = withClass(C.c6c, { templateId: TPL.default });
    const c = withTeacher(T.rizan, { maxPerDay: 0 }, { ...base, classes: base.classes.filter((k) => k.id !== C.c1a) });
    const w = find(c, 'capacity-short').find((i) => i.params.subjectId === S.islam);
    expect(w?.params).toEqual({ subjectId: S.islam, needed: 3, capacity: 0 });
  });

  it('raises only no-specialist when a specialist subject has no teacher at all', () => {
    const c = withoutTeachersFor(S.english, withGrade(G.g1, { number: 3 }));
    const forEnglish = (code: ReadinessCode) => find(c, code).filter((i) => i.params.classId === C.c1a && i.params.subjectId === S.english);
    expect(forEnglish('no-specialist')).toHaveLength(1);
    expect(forEnglish('no-qualified-teacher')).toHaveLength(0);
  });

  it('blocks a primary class teacher who does not teach the grade', () => {
    const issue = find(withTeacher(T.wickramasinghe, { grades: [2] }), 'class-teacher-wrong-grade')[0];
    expect(issue?.ref).toEqual({ kind: 'class', id: C.c1a });
    expect(issue?.params).toEqual({ classId: C.c1a, teacherId: T.wickramasinghe, grade: 1 });
  });

  it('measures minimum weekly loads against lesson demand with shared groups counted once', () => {
    const g = mahasen.ctx.grades[0]!;
    const plan: PlanItem[] = [
      { kind: 'group', key: 'rel', nameEn: 'Rel', optionSubjectIds: [mahasen.S.religion, mahasen.S.aesthetic], perWeek: 4 },
      { kind: 'subject', subjectId: mahasen.S.maths, perWeek: 5 },
    ];
    const base = withGrade(g.id, { plan }, mahasen.ctx);
    const short = withTeacher('mh-t-1a', { minPerWeek: 24 }, base);
    const issue = find(short, 'min-per-week-unreachable')[0];
    expect(issue?.ref).toEqual({ kind: 'school', id: '' });
    expect(issue?.params).toEqual({ needed: 24, available: 23 });
    expect(find(withTeacher('mh-t-1a', { minPerWeek: 23 }, base), 'min-per-week-unreachable')).toEqual([]);
  });

  it('lets a class teacher qualified only for a group option cover the first slot', () => {
    expect(codes(withClass(C.c6a, { classTeacherId: T.fernando }))).not.toContain('class-teacher-no-daily-subject');
  });

  it('subtracts the day activity credit from per-day minutes', () => {
    const t = mahasen.ctx.templates[0]!;
    const rows = t.rows.map((r) => (r.subjectId === mahasen.S.health ? { ...r, end: '07:50' } : r));
    const issue = find({ ...mahasen.ctx, templates: [{ ...t, rows }] }, 'per-day-unbuildable').find((i) => i.params.planKey === `subject:${mahasen.S.health}`);
    expect(issue?.params).toMatchObject({ day: 0, minutes: 5 });
  });

  it('judges a class with a plan override by its own plan', () => {
    const c = withClass(C.c6a, { planOverride: [{ kind: 'subject', subjectId: S.maths, perWeek: 6 }] }, withoutTeachersFor(S.geography));
    const forGeography = find(c, 'no-qualified-teacher').filter((i) => i.params.subjectId === S.geography).map((i) => i.params.classId);
    expect(forGeography).toContain(C.c6b);
    expect(forGeography).not.toContain(C.c6a);
  });

  it('orders issues by code then ref id', () => {
    const c = withClass(C.c6b, { classTeacherId: undefined }, withClass(C.c6a, { classTeacherId: undefined, templateId: TPL.default }));
    expect(readiness(c, []).blocking.map((i) => `${i.code}:${i.ref.id}`)).toEqual([`class-no-teacher:${C.c6a}`, `class-no-teacher:${C.c6b}`]);
  });
});
