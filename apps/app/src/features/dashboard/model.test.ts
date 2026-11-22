// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { C, ctx, entries, entry, S, T } from '@sathiya/core/fixtures';
import { describe, expect, it } from 'vitest';
import { attentionItems, classChips, dashboardStats } from './model';

describe('dashboard model', () => {
  it('computes stats from fixtures', () => {
    expect(dashboardStats(ctx, entries)).toEqual({ classCount: 5, classesComplete: 0, emptySlots: 145, clashes: 0, overLimit: 0 });
  });

  it('counts a teacher double-booked across classes as one clash', () => {
    const clash = [...entries, entry('x1', 0, 1, [C.c6c], [[S.maths, T.perera]])];
    expect(dashboardStats(ctx, clash).clashes).toBe(1);
  });

  it('flags over-limit teachers in stats', () => {
    const over = Array.from({ length: 8 }, (_, i) => entry(`o${i}`, 0, i + 1, [C.c6a], [[S.health, T.kumara]]));
    expect(dashboardStats(ctx, [...entries, ...over]).overLimit).toBe(1);
  });

  it('groups class chips by grade with status', () => {
    const groups = classChips(ctx, entries);
    expect(groups.map((g) => g.number)).toEqual([1, 6, 12]);
    const six = groups.find((g) => g.number === 6)!;
    expect(six.classes.map((c) => [c.name, c.status])).toEqual([
      ['6A', 'partial'],
      ['6B', 'partial'],
      ['6C', 'partial'],
    ]);
    expect(groups.find((g) => g.number === 12)!.classes[0]).toMatchObject({ name: '12A', placed: 0, needed: 40, status: 'empty' });
  });

  it('marks a class complete when every plan item is placed', () => {
    const plan = ctx.classes.find((c) => c.id === C.c12a)!.planOverride!;
    let slot = 0;
    const full = plan.flatMap((item) =>
      Array.from({ length: item.perWeek }, () => {
        const n = slot++;
        return entry(`f${n}`, (n % 5) as 0, 1 + Math.floor(n / 5), [C.c12a], [[item.kind === 'subject' ? item.subjectId : '', null]]);
      }),
    );
    const chip = classChips(ctx, [...entries, ...full]).find((g) => g.number === 12)!.classes[0]!;
    expect(chip).toMatchObject({ placed: 40, needed: 40, status: 'complete' });
    expect(dashboardStats(ctx, [...entries, ...full]).classesComplete).toBe(1);
  });

  it('builds attention items with links and no raw detail', () => {
    const over = Array.from({ length: 8 }, (_, i) => entry(`o${i}`, 0, i + 1, [C.c6a], [[S.sinhala, T.kumara]]));
    const items = attentionItems(ctx, [...entries, ...over], 'en');
    const limit = items.find((i) => i.kind === 'over-limit' && i.params.teacher === 'Mr. S. Kumara')!;
    expect(limit.to).toBe('/timetable/teacher?t=t-kumara');
    expect(limit.params).toMatchObject({ n: 8, max: 7, day: 0 });
    const target = items.find((i) => i.kind === 'over-target')!;
    expect(target.to).toMatch(/^\/timetable\/class\?c=c-6a/);
    expect(JSON.stringify(items)).not.toMatch(/periods on|outside the class/);
    const si = attentionItems(ctx, [...entries, ...over], 'si').find((i) => i.kind === 'over-limit')!;
    expect(si.params.teacher).toBe('S. Kumara මහතා');
  });
});
