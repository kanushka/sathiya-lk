import { describe, expect, it } from 'vitest';
import { withTeacherIds } from './clash';
import { fillWithClassTeacher } from './fill';
import { C, ctx, entries6B, T } from './fixtures';
import { currentAndNext } from './now';
import { buildSnapshots, type SnapshotCell } from './publish';

const sixB = buildSnapshots(ctx, entries6B, { id: 'y', label: '2026', status: 'draft' }).classes.find((c) => c.classId === C.c6b)!;
const wed = (h: number, m: number) => new Date(2026, 10, 25, h, m);

describe('currentAndNext', () => {
  it('uses a Wednesday date', () => {
    expect(wed(9, 20).getDay()).toBe(3);
  });

  it('finds the current period and minutes left', () => {
    const r = currentAndNext(sixB.cells, sixB.rows, wed(9, 20));
    expect(r.day).toBe(2);
    expect(r.current).toMatchObject({ period: 3, title: 'Maths' });
    expect(r.minutesLeft).toBe(30);
    expect(r.next).toMatchObject({ period: 5, start: '10:50' });
  });

  it('returns day null on weekends', () => {
    expect(currentAndNext(sixB.cells, sixB.rows, new Date(2026, 10, 28, 9, 20))).toEqual({ day: null });
  });

  it('shows no current period during the interval and next = P5', () => {
    const r = currentAndNext(sixB.cells, sixB.rows, wed(10, 40));
    expect(r.current).toBeUndefined();
    expect(r.next).toMatchObject({ period: 5, start: '10:50' });
  });

  it('marks an empty period as free and points next after it', () => {
    const r = currentAndNext(sixB.cells, sixB.rows, wed(10, 0));
    expect(r.current).toEqual({ free: true, start: '09:50', end: '10:30' });
    expect(r.minutesLeft).toBe(30);
    expect(r.next).toMatchObject({ period: 5 });
  });

  it('points to the first period before school and nothing after', () => {
    const before = currentAndNext(sixB.cells, sixB.rows, wed(7, 0));
    expect(before.current).toBeUndefined();
    expect(before.next).toMatchObject({ period: 1, start: '07:45' });
    expect(currentAndNext(sixB.cells, sixB.rows, wed(15, 0))).toEqual({ day: 2 });
  });

  describe('teacher with classes on another template', () => {
    const filled1A = fillWithClassTeacher({ ctx, entries: [], classId: C.c1a }).map((d, i) => ({ ...withTeacherIds(d), id: `f-${i}` }));
    const w = buildSnapshots(ctx, filled1A, { id: 'y', label: '2026', status: 'draft' }).teachers.find((t) => t.teacherId === T.wickramasinghe)!;
    const mon = (h: number, m: number) => new Date(2026, 10, 23, h, m);

    it('picks the cell whose own clock times cover now', () => {
      const r = currentAndNext(w.cells, w.rows, mon(9, 5));
      expect(r.current).toMatchObject({ start: '09:00', end: '09:40', title: '1A' });
      expect(r.minutesLeft).toBe(35);
      expect(r.next).toMatchObject({ start: '09:40', end: '10:20' });
    });

    it('distinguishes two cells mapped to the same default period', () => {
      expect(w.cells.filter((c) => c.day === 0 && c.period === 5)).toHaveLength(2);
      const r = currentAndNext(w.cells, w.rows, mon(11, 10));
      expect(r.current).toMatchObject({ start: '11:05', end: '11:30' });
      expect(r.minutesLeft).toBe(20);
      expect(r.next).toBeUndefined();
    });

    it('is free inside a default period row no cell covers', () => {
      const r = currentAndNext(w.cells, w.rows, mon(10, 25));
      expect(r.current).toEqual({ free: true, start: '09:50', end: '10:30' });
      expect(r.minutesLeft).toBe(5);
      expect(r.next).toMatchObject({ start: '10:40', end: '11:05' });
    });

    it('has no current during the default interval', () => {
      const r = currentAndNext(w.cells, w.rows, mon(10, 35));
      expect(r.current).toBeUndefined();
      expect(r.next).toMatchObject({ start: '10:40' });
    });
  });

  describe('free default row partly covered by a cell on another template', () => {
    const w = buildSnapshots(ctx, [], { id: 'y', label: '2026', status: 'draft' }).teachers.find((t) => t.teacherId === T.wickramasinghe)!;
    const cell = (start: string, end: string, period: number): SnapshotCell => ({ day: 0, period, start, end, title: '1A', sub: 'Sinhala', color: '', isGroup: false });
    const mon = (h: number, m: number) => new Date(2026, 10, 23, h, m);

    it('does not skip a cell that starts inside the free row', () => {
      const r = currentAndNext([cell('09:40', '10:20', 4)], w.rows, mon(9, 15));
      expect(r.current).toEqual({ free: true, start: '09:10', end: '09:40' });
      expect(r.minutesLeft).toBe(25);
      expect(r.next).toMatchObject({ start: '09:40', end: '10:20' });
    });
  });
});
