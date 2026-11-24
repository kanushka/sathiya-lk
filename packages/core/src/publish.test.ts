// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { withTeacherIds } from './clash';
import { fillWithClassTeacher } from './fill';
import { C, ctx, entries, entries6B, mahasen, S, T } from './fixtures';
import { buildSnapshots } from './publish';
import type { Entry, Year } from './types';

const year: Year = { id: 'y-2026', label: '2026', status: 'draft' };
const filled6B: Entry[] = [
  ...entries6B,
  ...fillWithClassTeacher({ ctx, entries: entries6B, classId: C.c6b }).map((d, i) => ({ ...withTeacherIds(d), id: `fill-${i}` })),
];

describe('buildSnapshots', () => {
  const { classes, teachers } = buildSnapshots(ctx, filled6B, year);
  const sixB = classes.find((c) => c.classId === C.c6b)!;

  it('produces one snapshot per class and per teacher', () => {
    expect(classes).toHaveLength(ctx.classes.length);
    expect(teachers).toHaveLength(ctx.teachers.length);
  });

  it('builds a full 6B class snapshot', () => {
    expect(sixB.cells).toHaveLength(40);
    expect(sixB.cells.find((c) => c.day === 0 && c.period === 5)?.start).toBe('10:50');
    expect(sixB).toMatchObject({ className: '6B', gradeNumber: 6, classTeacher: 'Mrs. N. Perera', yearLabel: '2026', schoolName: { nameEn: 'Siripura Central College', nameSi: 'සිරිපුර මධ්‍ය විද්‍යාලය' } });
    expect(sixB.cells.find((c) => c.day === 0 && c.period === 1)).toEqual({ day: 0, period: 1, start: '07:45', end: '08:30', title: 'Maths', titleSi: 'ගණිතය', sub: 'Mrs. N. Perera', color: '#D4ECEA', isGroup: false, entryId: 'e-6b-0-1', classIds: [C.c6b], subjectId: S.maths });
  });

  it('teacher cells carry entryId, classIds, subjectId', () => {
    const e = filled6B.find((x) => x.teacherIds.includes(T.perera) && x.groupKey === undefined)!;
    const lesson = e.lessons.find((l) => l.teacherId === T.perera)!;
    const cell = teachers.find((t) => t.teacherId === T.perera)!.cells.find((c) => c.entryId === e.id)!;
    expect(cell).toMatchObject({ entryId: e.id, classIds: e.classIds, subjectId: lesson.subjectId });
    const classCellFor = sixB.cells.find((c) => c.entryId === e.id)!;
    expect(classCellFor).toMatchObject({ entryId: e.id, classIds: e.classIds, subjectId: e.lessons[0]!.subjectId });
    const group = filled6B.find((x) => x.groupKey !== undefined && x.classIds.includes(C.c6b))!;
    expect(sixB.cells.find((c) => c.entryId === group.id)).toMatchObject({ classIds: group.classIds, subjectId: group.lessons[0]!.subjectId });
  });

  it('keeps activity rows in class snapshots', () => {
    const { classes: mh } = buildSnapshots(mahasen.ctx, [], year);
    const rows = mahasen.ctx.templates[0]!.rows;
    expect(mh[0]!.rows[0]).toEqual(rows);
    expect(mh[0]!.rows[0].filter((r) => r.type === 'activity').map((r) => r.nameEn)).toEqual(['Assembly', 'Health & PE', 'School meal']);
  });

  it('sorts cells by day then start', () => {
    const keys = sixB.cells.map((c) => c.day * 10000 + Number(c.start.replace(':', '')));
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it('renders group cells with the group name and the other classes', () => {
    const religion = sixB.cells.find((c) => c.day === 2 && c.period === 2)!;
    expect(religion).toMatchObject({ isGroup: true, title: 'Religion', titleSi: 'ආගම', sub: 'Group · 6A', otherClasses: ['6A'], color: '#FBEAC9' });
    const aesthetic = sixB.cells.find((c) => c.day === 4 && c.period === 3)!;
    expect(aesthetic).toMatchObject({ isGroup: true, title: 'Aesthetic', sub: 'Group', otherClasses: [], color: '#EBDDF2' });
  });

  it('gives the teacher snapshot the class and subject per cell', () => {
    const perera = teachers.find((t) => t.teacherId === T.perera)!;
    expect(perera).toMatchObject({ name: 'Mrs. N. Perera', staffId: 'SCC024', yearLabel: '2026' });
    const maths = perera.cells.filter((c) => c.title === '6B' && c.sub === 'Mathematics');
    expect(maths).toHaveLength(6);
    expect(maths[0]).toEqual({ day: 0, period: 1, start: '07:45', end: '08:30', title: '6B', sub: 'Mathematics', subSi: 'ගණිතය', color: '#D4ECEA', isGroup: false, entryId: 'e-6b-0-1', classIds: [C.c6b], subjectId: S.maths });
    expect(perera.rows[0]).toEqual(ctx.templates.find((t) => t.isDefault)!.rows);
  });

  it('lists a teacher in a group entry with their own option', () => {
    const ananda = buildSnapshots(ctx, filled6B, year).teachers.find((t) => t.teacherId === T.ananda)!;
    expect(ananda.cells.find((c) => c.day === 2 && c.period === 2)).toMatchObject({ title: '6A+6B', sub: 'Buddhism', isGroup: true });
  });

  it('maps a Primary entry onto the overlapping default period with real times', () => {
    const { classes: cls, teachers: tch } = buildSnapshots(ctx, entries, year);
    const w = tch.find((t) => t.teacherId === T.wickramasinghe)!;
    expect(w.cells.find((c) => c.day === 1)).toMatchObject({ period: 3, start: '09:00', end: '09:40', title: '1A', sub: 'Mathematics' });
    const oneA = cls.find((c) => c.classId === C.c1a)!;
    expect(oneA.rows[0]).toEqual(ctx.templates.find((t) => t.id === 'tpl-primary')!.rows);
    expect(oneA.gradeNumber).toBe(1);
  });

  it('uses per-day rows and skips orphaned entries', () => {
    const orphan: Entry = { id: 'o', day: 4, period: 8, classIds: [C.c6c], lessons: [{ subjectId: 's-maths', teacherId: T.bandara }], teacherIds: [T.bandara] };
    const { classes: cls } = buildSnapshots(ctx, [orphan], year);
    const sixC = cls.find((c) => c.classId === C.c6c)!;
    expect(sixC.rows[4].filter((r) => r.type === 'period')).toHaveLength(7);
    expect(sixC.cells).toEqual([]);
  });

  it('omits whitespace-only Sinhala names and trims the rest', () => {
    const blank = { ...ctx, subjects: ctx.subjects.map((s) => (s.id === 's-maths' ? { ...s, nameSi: '   ' } : s.id === 's-science' ? { ...s, nameSi: ' විද්‍යාව ' } : s)) };
    const snap = buildSnapshots(blank, filled6B, year);
    const sixBCells = snap.classes.find((c) => c.classId === C.c6b)!.cells;
    expect(sixBCells.find((c) => c.day === 0 && c.period === 1)).not.toHaveProperty('titleSi');
    expect(sixBCells.find((c) => c.day === 0 && c.period === 2)?.titleSi).toBe('විද්‍යාව');
    const perera = snap.teachers.find((t) => t.teacherId === T.perera)!;
    expect(perera.cells.find((c) => c.sub === 'Mathematics')).not.toHaveProperty('subSi');
  });

  it('marks combined (non-group) class cells with the other classes', () => {
    const combined: Entry = { id: 'cmb', day: 0, period: 1, classIds: [C.c6a, C.c6b], lessons: [{ subjectId: 's-maths', teacherId: T.bandara }], teacherIds: [T.bandara] };
    const snap = buildSnapshots(ctx, [combined], year);
    expect(snap.classes.find((c) => c.classId === C.c6a)!.cells[0]).toMatchObject({ isGroup: false, title: 'Maths', sub: 'Mr. P. Bandara', otherClasses: ['6B'] });
    expect(snap.classes.find((c) => c.classId === C.c6b)!.cells[0]).toMatchObject({ otherClasses: ['6A'] });
    expect(sixB.cells.find((c) => c.day === 0 && c.period === 1)).not.toHaveProperty('otherClasses');
  });

  it('carries teacher display names with the title in both languages', () => {
    expect(ctx.teachers.find((t) => t.id === T.perera)).toMatchObject({ title: 'Mrs', name: 'N. Perera' });
    expect(sixB).toMatchObject({ classTeacher: 'Mrs. N. Perera' });
    expect(sixB).not.toHaveProperty('classTeacherSi');
    const withSi = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.perera ? { ...t, nameSi: 'එන්. පෙරේරා' } : t)) };
    const both = buildSnapshots(withSi, filled6B, year);
    expect(both.classes.find((c) => c.classId === C.c6b)).toMatchObject({ classTeacher: 'Mrs. N. Perera', classTeacherSi: 'එන්. පෙරේරා මහත්මිය' });
    expect(both.teachers.find((t) => t.teacherId === T.perera)).toMatchObject({ name: 'Mrs. N. Perera', nameSi: 'එන්. පෙරේරා මහත්මිය' });
    const siOnly = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.perera ? { ...t, name: '', nameSi: 'එන්. පෙරේරා' } : t)) };
    expect(buildSnapshots(siOnly, filled6B, year).teachers.find((t) => t.teacherId === T.perera)).toMatchObject({ name: 'එන්. පෙරේරා මහත්මිය' });
    const untitled = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.perera ? { ...t, title: undefined, name: 'N. Perera' } : t)) };
    const snap = buildSnapshots(untitled, filled6B, year);
    expect(snap.teachers.find((t) => t.teacherId === T.perera)).not.toHaveProperty('nameSi');
    expect(snap.classes.find((c) => c.classId === C.c6b)).not.toHaveProperty('classTeacherSi');
    expect(snap.classes.find((c) => c.classId === C.c6b)!.cells.find((c) => c.day === 0 && c.period === 1)).not.toHaveProperty('subSi');
  });

  it('keeps a teacher cell whose class period overlaps no default period', () => {
    const late = { ...ctx.templates.find((t) => t.id === 'tpl-primary')!, rows: [...ctx.templates.find((t) => t.id === 'tpl-primary')!.rows, { type: 'period' as const, start: '13:40', end: '14:20' }] };
    const lateCtx = { ...ctx, templates: ctx.templates.map((t) => (t.id === late.id ? late : t)) };
    const e: Entry = { id: 'late', day: 0, period: 7, classIds: [C.c1a], lessons: [{ subjectId: 's-sinhala', teacherId: T.wickramasinghe }], teacherIds: [T.wickramasinghe] };
    const w = buildSnapshots(lateCtx, [e], year).teachers.find((t) => t.teacherId === T.wickramasinghe)!;
    expect(w.cells).toEqual([expect.objectContaining({ day: 0, period: 8, start: '13:40', end: '14:20', title: '1A' })]);
  });
});

