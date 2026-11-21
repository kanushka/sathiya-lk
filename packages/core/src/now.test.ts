import { describe, expect, it } from 'vitest';
import { C, ctx, entries6B } from './fixtures';
import { currentAndNext } from './now';
import { buildSnapshots } from './publish';

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
});
