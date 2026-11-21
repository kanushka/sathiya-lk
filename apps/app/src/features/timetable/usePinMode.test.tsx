// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { C, ctx, entries6B, S, T } from '@sathiya/core/fixtures';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import { usePinMode, type PinMode } from './usePinMode';
import { TimetableApiContext, useTimetable, type TimetableApi } from './useTimetable';

let pin: PinMode;
function Probe() {
  const tt = useTimetable();
  pin = usePinMode({ ctx: tt.ctx, classId: C.c6b, entries: tt.entries, save: tt.save, remove: tt.remove });
  return null;
}

function setup(api: Partial<TimetableApi> = {}) {
  const full: TimetableApi = {
    saveEntry: vi.fn().mockResolvedValue({ entryId: 'new' }),
    deleteEntry: vi.fn().mockResolvedValue({ ok: true }),
    ...api,
  };
  renderWithSchool(
    <TimetableApiContext.Provider value={full}>
      <Probe />
    </TimetableApiContext.Provider>,
    { ctx, entries: entries6B },
  );
  return full;
}

const science = { subjectId: S.science, teacherId: T.gunasekara };
const cell = (day: number, period: number) => pin.slots.find((s) => s.day === day && s.period === period)?.cell.kind;

describe('usePinMode', () => {
  it('is off until started, then exposes slots and progress for the target', () => {
    setup();
    expect(pin.target).toBeNull();
    expect(pin.slots).toEqual([]);
    act(() => pin.start(science));
    expect(pin.target).toEqual(science);
    expect(pin.progress).toEqual({ placed: 3, needed: 5, left: 2, over: 0 });
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
    expect(pin.progress).toEqual({ placed: 5, needed: 5, left: 0, over: 0 });
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
    expect(pin.progress).toEqual({ placed: 5, needed: 5, left: 0, over: 0 });
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
    expect(pin.message).toBe('Pin mode on: Science with Mrs. S. Gunasekara. Click free periods to pin, Esc to finish.');
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
});
