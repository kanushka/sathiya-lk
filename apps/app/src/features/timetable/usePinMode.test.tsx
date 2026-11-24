// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { periodsFor, singleSpec, type DayIndex, type Entry } from '@sathiya/core';
import { C, ctx, entries6B, entry, mahasen, S, T, TPL } from '@sathiya/core/fixtures';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import { usePinMode, type PinMode, type PinView } from './usePinMode';
import { TimetableApiContext, useTimetable, type TimetableApi } from './useTimetable';

let pin: PinMode;
let viewArg: PinView = { kind: 'class' };
function Probe() {
  const tt = useTimetable();
  pin = usePinMode({ ctx: tt.ctx, entries: tt.entries, save: tt.save, remove: tt.remove, view: viewArg });
  return null;
}

function setup(api: Partial<TimetableApi> = {}, es: Entry[] = entries6B, view: PinView = { kind: 'class' }, schoolCtx = ctx) {
  viewArg = view;
  const full: TimetableApi = {
    saveEntry: vi.fn().mockResolvedValue({ entryId: 'new' }),
    deleteEntry: vi.fn().mockResolvedValue({ ok: true }),
    ...api,
  };
  renderWithSchool(
    <TimetableApiContext.Provider value={full}>
      <Probe />
    </TimetableApiContext.Provider>,
    { ctx: schoolCtx, entries: es },
  );
  return full;
}

const science = singleSpec(C.c6b, S.science, T.gunasekara);
const cell = (day: number, period: number) => pin.cellAt(day as DayIndex, period)?.kind;

describe('usePinMode', () => {
  it('is off until started, then exposes slots and progress for the target', () => {
    setup();
    expect(pin.target).toBeNull();
    expect(pin.cellAt(2, 4)).toBeUndefined();
    act(() => pin.start(science));
    expect(pin.target).toEqual(science);
    expect(pin.progress).toEqual({ placed: 3, needed: 5, left: 2, over: 0, full: [], unit: 'periods' });
    expect(cell(2, 4)).toBe('free');
    expect(cell(4, 1)).toBe('pinned');
    expect(cell(0, 1)).toBe('taken');
  });

  it('pins a free slot optimistically and announces it', async () => {
    const api = setup();
    act(() => pin.start(science));
    await act(async () => {
      await pin.toggle(2, 4);
    });
    expect(api.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ entry: { day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.science, teacherId: T.gunasekara }] } }));
    expect(cell(2, 4)).toBe('pinned');
    expect(pin.progress?.placed).toBe(4);
    expect(pin.message).toBe('Science pinned to Wednesday, period 4.');
  });

  it('announces the last pin even when an earlier save finishes after it', async () => {
    const resolvers: Array<(v: { entryId: string }) => void> = [];
    setup({ saveEntry: vi.fn(() => new Promise<{ entryId: string }>((r) => resolvers.push(r))) });
    act(() => pin.start(science));
    const free: Array<[DayIndex, number]> = [];
    for (const d of [0, 1, 2, 3, 4] as DayIndex[]) for (let p = 1; p <= 8; p++) if (cell(d, p) === 'free') free.push([d, p]);
    const [a, b] = [free[0]!, free.find(([d]) => d !== free[0]![0])!];
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = pin.toggle(...a);
    });
    act(() => {
      second = pin.toggle(...b);
    });
    await act(async () => {
      resolvers[1]!({ entryId: 'b' });
      await second;
    });
    await act(async () => {
      resolvers[0]!({ entryId: 'a' });
      await first;
    });
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    expect(pin.message).toBe(`Science pinned to ${days[b[0]]}, period ${b[1]}.`);
  });

  it('unpins a pinned slot', async () => {
    const api = setup();
    act(() => pin.start(science));
    await act(async () => {
      await pin.toggle(4, 1);
    });
    expect(api.deleteEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e-6b-4-1' }));
    expect(cell(4, 1)).toBe('free');
    expect(pin.message).toBe('Science removed from Friday, period 1.');
  });

  it('ignores taken and busy slots', async () => {
    const api = setup();
    act(() => pin.start(science));
    await act(async () => {
      await pin.toggle(0, 1);
    });
    expect(api.saveEntry).not.toHaveBeenCalled();
    expect(api.deleteEntry).not.toHaveBeenCalled();
  });

  it('rolls a clashing pin back and shows the conflicts', async () => {
    setup({ saveEntry: vi.fn().mockRejectedValue(new ApiError('clash', 'clash', { conflicts: [{ kind: 'teacher', id: T.gunasekara, entryId: 'x' }] })) });
    act(() => pin.start(science));
    await act(async () => {
      await pin.toggle(2, 4);
    });
    expect(cell(2, 4)).toBe('free');
    expect(await screen.findByText('Clash: Mrs. S. Gunasekara is already teaching at this time')).toBeInTheDocument();
    expect(pin.message).toBe('');
  });

  it('suggests the remaining needed periods spread across days, then pins them', async () => {
    const api = setup();
    act(() => pin.start(science));
    act(() => pin.suggest());
    expect(pin.suggested).toEqual([
      { day: 2, period: 4 },
      { day: 3, period: 7 },
    ]);
    expect(pin.message).toBe('Suggested 2 slots, spread across days.');
    await act(async () => {
      await pin.pinSuggested();
    });
    expect(api.saveEntry).toHaveBeenCalledTimes(2);
    expect(pin.suggested).toEqual([]);
    expect(pin.progress).toEqual({ placed: 5, needed: 5, left: 0, over: 0, full: [], unit: 'periods' });
    expect(pin.message).toBe('Pinned 2 Science lessons.');
  });

  it('drops a suggestion once that slot is pinned by hand', async () => {
    setup();
    act(() => pin.start(science));
    act(() => pin.suggest());
    await act(async () => {
      await pin.toggle(2, 4);
    });
    expect(pin.suggested).toEqual([{ day: 3, period: 7 }]);
  });

  it('stop clears the target and suggestions', async () => {
    setup();
    act(() => pin.start(science));
    act(() => pin.suggest());
    act(() => pin.stop());
    await waitFor(() => expect(pin.target).toBeNull());
    expect(pin.suggested).toEqual([]);
  });

  it('caps suggestions at what is still needed after hand pins', async () => {
    const api = setup();
    act(() => pin.start(science));
    act(() => pin.suggest());
    expect(pin.suggested).toHaveLength(2);
    await act(async () => {
      await pin.toggle(4, 5);
    });
    expect(pin.progress?.left).toBe(1);
    expect(pin.suggested).toEqual([{ day: 2, period: 4 }]);
    await act(async () => {
      await pin.pinSuggested();
    });
    expect(api.saveEntry).toHaveBeenCalledTimes(2);
    expect(pin.progress).toEqual({ placed: 5, needed: 5, left: 0, over: 0, full: [], unit: 'periods' });
    expect(pin.suggested).toEqual([]);
  });

  it('drops all suggestions once the plan is met by hand', async () => {
    setup();
    act(() => pin.start(science));
    act(() => pin.suggest());
    await act(async () => {
      await pin.toggle(4, 5);
      await pin.toggle(4, 6);
    });
    expect(pin.suggested).toEqual([]);
  });

  it('announces entering and leaving pin mode', () => {
    setup();
    act(() => pin.start(science));
    expect(pin.message).toBe('Pin mode on: Science with Mrs. S. Gunasekara. Choose free periods to pin, Esc to finish.');
    act(() => pin.stop());
    expect(pin.message).toBe('Pin mode off.');
  });

  it('reports the final state when a pin is undone before it settles', async () => {
    let resolveSave!: (v: { entryId: string }) => void;
    setup({ saveEntry: vi.fn(() => new Promise<{ entryId: string }>((r) => (resolveSave = r))) });
    act(() => pin.start(science));
    let first!: Promise<void>;
    act(() => {
      first = pin.toggle(2, 4);
    });
    expect(cell(2, 4)).toBe('pinned');
    await act(async () => {
      await pin.toggle(2, 4);
    });
    await act(async () => {
      resolveSave({ entryId: 'late' });
      await first;
    });
    expect(pin.message).toBe('Science removed from Wednesday, period 4.');
  });

  it('exposes title, detail and colour for a single spec', () => {
    setup();
    expect(pin.names).toBeNull();
    act(() => pin.start(science));
    expect(pin.names).toMatchObject({ title: 'Science · Mrs. S. Gunasekara', subject: 'Science', teacher: 'Mrs. S. Gunasekara' });
    expect(pin.names?.detail).toBeUndefined();
  });
});

describe('usePinMode with a group spec', () => {
  const group = { classIds: [C.c6a, C.c6b], lessons: [{ subjectId: S.buddhism, teacherId: T.ananda }, { subjectId: S.islam, teacherId: T.rizan }], groupKey: 'religion' };

  it('announces the group and writes every lesson and class', async () => {
    const api = setup({}, []);
    act(() => pin.start(group));
    expect(pin.message).toBe('Pin mode on: Religion for 6A+6B. Choose free periods to pin, Esc to finish.');
    expect(pin.names).toMatchObject({ title: 'Religion · 6A+6B', subject: 'Religion' });
    expect(pin.names?.detail).toContain('Buddhism');
    await act(async () => {
      await pin.toggle(0, 1);
    });
    expect(api.saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({ entry: { day: 0, period: 1, classIds: [C.c6a, C.c6b], lessons: group.lessons, groupKey: 'religion' } }),
    );
    expect(pin.message).toBe('Religion pinned to Monday, period 1.');
  });
});

describe('usePinMode with a joined class at its target', () => {
  const aesthetic = {
    classIds: [C.c6a, C.c6b],
    lessons: [
      { subjectId: S.music, teacherId: T.fernando },
      { subjectId: S.dancing, teacherId: T.senanayake },
      { subjectId: S.art, teacherId: T.dissanayake },
    ],
    groupKey: 'aesthetic',
  };

  it('names the full class and refuses a hand pin', async () => {
    const api = setup();
    act(() => pin.start(aesthetic));
    expect(pin.progress).toMatchObject({ placed: 0, needed: 3, left: 0 });
    expect(pin.fullNote).toBe('6B already has 3/3');
    const free = ([0, 1, 2, 3, 4] as DayIndex[]).flatMap((d) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => [d, p] as [DayIndex, number])).find(([d, p]) => cell(d, p) === 'free')!;
    await act(async () => {
      await pin.toggle(...free);
    });
    expect(api.saveEntry).not.toHaveBeenCalled();
    expect(pin.message).toBe('6B already has 3/3');
  });

  it('suggests nothing', () => {
    setup();
    act(() => pin.start(aesthetic));
    act(() => pin.suggest());
    expect(pin.suggested).toEqual([]);
  });

  it('stops suggestions at the smallest remaining count across classes', async () => {
    const api = setup();
    act(() => pin.start({ classIds: [C.c6a, C.c6b], lessons: [{ subjectId: S.science, teacherId: T.gunasekara }] }));
    expect(pin.progress?.left).toBe(2);
    act(() => pin.suggest());
    expect(pin.suggested).toHaveLength(2);
    await act(async () => {
      await pin.pinSuggested();
    });
    expect(api.saveEntry).toHaveBeenCalledTimes(2);
  });

  it('pins no more suggestions than are still needed after a hand pin', async () => {
    const api = setup();
    act(() => pin.start({ classIds: [C.c6a, C.c6b], lessons: [{ subjectId: S.science, teacherId: T.gunasekara }] }));
    act(() => pin.suggest());
    expect(pin.suggested).toHaveLength(2);
    const other = ([0, 1, 2, 3, 4] as DayIndex[])
      .flatMap((d) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => [d, p] as [DayIndex, number]))
      .find(([d, p]) => cell(d, p) === 'free' && !pin.isSuggested(d, p))!;
    await act(async () => {
      await pin.toggle(...other);
    });
    expect(pin.progress?.left).toBe(1);
    await act(async () => {
      await pin.pinSuggested();
    });
    expect(api.saveEntry).toHaveBeenCalledTimes(2);
  });
});

describe('usePinMode in the teacher view', () => {
  const spec = singleSpec(C.c1a, S.maths, T.wickramasinghe);
  const view: PinView = { kind: 'teacher', teacherId: T.wickramasinghe };

  it('reads cells by teacher row and writes the class period', async () => {
    const api = setup({}, [], view);
    act(() => pin.start(spec));
    expect(pin.cellAt(1, 5)?.kind).toBe('free');
    expect(pin.cellAt(1, 6)?.kind).toBe('none');
    expect(pin.periodAt(1, 5)).toBe(5);
    expect(pin.periodAt(1, 6)).toBeNull();
    await act(async () => {
      await pin.toggle(1, 5);
    });
    expect(api.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ entry: { day: 1, period: 5, classIds: [C.c1a], lessons: [{ subjectId: S.maths, teacherId: T.wickramasinghe }] } }));
    expect(pin.message).toBe('Mathematics pinned to Tuesday, period 5.');
  });

  it('titles the bar by subject and classes and explains another template', () => {
    setup({}, [], view);
    act(() => pin.start(spec));
    expect(pin.names?.title).toBe('Mathematics · 1A');
    expect(pin.names?.detail).toBe('1A runs on the Primary (Gr 1–2) template: cells show its own period and time where they differ');
  });

  it('has no detail for a class on the default template', () => {
    setup({}, [], { kind: 'teacher', teacherId: T.rizan });
    act(() => pin.start(singleSpec(C.c6b, S.english, T.rizan)));
    expect(pin.names?.title).toBe('English · 6B');
    expect(pin.names?.detail).toBeUndefined();
  });

  it('keeps the group title and adds the template note to the group detail', () => {
    setup({}, [], { kind: 'teacher', teacherId: T.ananda });
    act(() => pin.start({ classIds: [C.c6c], lessons: [{ subjectId: S.buddhism, teacherId: T.ananda }], groupKey: 'religion' }));
    expect(pin.names?.title).toBe('Religion · 6C');
    expect(pin.names?.detail).toBe('Buddhism – Ven. Ananda Thero · 6C runs on the Short Friday template: cells show its own period and time where they differ');
  });

  it('ignores rows with no period of the class', async () => {
    const api = setup({}, [], view);
    act(() => pin.start(spec));
    await act(async () => {
      await pin.toggle(1, 6);
    });
    expect(api.saveEntry).not.toHaveBeenCalled();
  });

  it('names the class when starting', () => {
    setup({}, [], view);
    act(() => pin.start(spec));
    expect(pin.message).toBe('Pin mode on: Mathematics for 1A. Choose free periods to pin, Esc to finish.');
  });

  it('suggests only periods shown on a free row and announces that count', () => {
    const primary = ctx.templates.find((x) => x.id === TPL.primary)!;
    const filler = ([0, 1, 2, 3, 4] as DayIndex[]).flatMap((day) =>
      periodsFor(primary, day)
        .filter(({ period }) => day !== 1 || (period !== 5 && period !== 6))
        .map(({ period }) => entry(`f-${day}-${period}`, day, period, [C.c1a], [[S.science, T.kumari]])),
    );
    setup({}, filler, view);
    act(() => pin.start(spec));
    act(() => pin.suggest());
    expect(pin.suggested).toEqual([{ day: 1, period: 5 }]);
    expect(pin.message).toBe('Suggested 1 slot, spread across days.');
  });

  it('maps suggestions to rows', () => {
    setup({}, [], view);
    act(() => pin.start(spec));
    act(() => pin.suggest());
    expect(pin.suggested.length).toBeGreaterThan(0);
    const s = pin.suggested[0]!;
    expect(pin.isSuggested(s.day, s.period)).toBe(true);
    expect(pin.cellAt(s.day, s.period)?.kind).toBe('free');
  });
});

describe('usePinMode with a minutes target', () => {
  const maths = singleSpec('mh-c-1a', mahasen.S.maths, 'mh-t-1a');

  it('suggests slots within the remaining minutes and labels the rest in minutes', () => {
    setup({}, [], { kind: 'class' }, mahasen.ctx);
    act(() => pin.start(maths));
    expect(pin.progress).toMatchObject({ placed: 0, needed: 190, left: 190, unit: 'minutes' });
    act(() => pin.suggest());
    expect(pin.suggested.length).toBeGreaterThan(0);
    expect(pin.suggested.length).toBeLessThan(190);
    const minutes = pin.suggested.reduce((n, s) => n + (s.period === 1 ? 60 : [0, 60, 15, 30, 10, 55, 10, 20][s.period]!), 0);
    expect(minutes).toBeLessThanOrEqual(190);
  });

  it('notes a full joined class in minutes', () => {
    const es = [entry('m1', 0, 1, ['mh-c-1b'], [[mahasen.S.maths, 'mh-t-1a']])];
    const spec = { ...maths, classIds: ['mh-c-1a', 'mh-c-1b'] };
    const full = [1, 2, 3].flatMap((d) => [1, 5].map((p) => entry(`f${d}${p}`, d as DayIndex, p, ['mh-c-1b'], [[mahasen.S.maths, 'mh-t-1a']])));
    setup({}, [...es, ...full], { kind: 'class' }, mahasen.ctx);
    act(() => pin.start(spec));
    expect(pin.progress?.full[0]?.unit).toBe('minutes');
    expect(pin.fullNote).toMatch(/1b already has .*h/i);
  });

  const mins = [0, 60, 15, 30, 10, 55, 10, 20];
  const sum = (list: Array<{ period: number }>) => list.reduce((n, x) => n + mins[x.period]!, 0);

  it('drops suggestions that no longer fit once slots are pinned by hand', async () => {
    setup({}, [], { kind: 'class' }, mahasen.ctx);
    act(() => pin.start(maths));
    act(() => pin.suggest());
    await act(async () => {
      await pin.toggle(4, 1);
    });
    expect(pin.progress?.left).toBe(130);
    expect(sum(pin.suggested)).toBeLessThanOrEqual(130);
  });

  it('refuses a hand pin longer than the minutes still needed', async () => {
    setup({}, [], { kind: 'class' }, mahasen.ctx);
    act(() => pin.start(maths));
    for (const d of [1, 2, 3] as DayIndex[]) {
      await act(async () => {
        await pin.toggle(d, 1);
      });
    }
    expect(pin.progress?.left).toBe(10);
    const before = pin.progress?.placed;
    await act(async () => {
      await pin.toggle(4, 1);
    });
    expect(pin.progress?.placed).toBe(before);
    expect(pin.message).toContain('longer than the 10 min still needed');
  });
});
