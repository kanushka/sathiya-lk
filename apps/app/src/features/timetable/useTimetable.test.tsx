import { ApiError } from '../../lib/callable';
import { C, ctx, entries6B, S, T } from '@sathiya/core/fixtures';
import type { EntryDraft } from '@sathiya/core';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { TimetableApiContext, useTimetable, type TimetableApi, type UseTimetable } from './useTimetable';

let latest: UseTimetable;
function Probe() {
  latest = useTimetable();
  return <div data-testid="n">{latest.entries.length}</div>;
}

const draft: EntryDraft = { day: 0, period: 8, classIds: [C.c6b], lessons: [{ subjectId: S.maths, teacherId: T.perera }] };

function setup(api: TimetableApi) {
  return renderWithSchool(
    <TimetableApiContext.Provider value={api}>
      <Probe />
    </TimetableApiContext.Provider>,
    { ctx, entries: entries6B },
  );
}

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe('useTimetable', () => {
  it('shows an optimistic add immediately with teacherIds', async () => {
    const d = deferred<{ entryId: string }>();
    const api: TimetableApi = { saveEntry: vi.fn(() => d.promise), deleteEntry: vi.fn() };
    setup(api);
    const before = entries6B.length;
    let p!: Promise<boolean>;
    act(() => {
      p = latest.save(draft);
    });
    expect(screen.getByTestId('n')).toHaveTextContent(String(before + 1));
    expect(latest.pending).toBe(true);
    const added = latest.entries.find((e) => e.id.startsWith('tmp-'));
    expect(added?.teacherIds).toEqual([T.perera]);
    expect(api.saveEntry).toHaveBeenCalledWith({ schoolId: ctx.school.id, yearId: 'y-2026', entry: draft });
    await act(async () => {
      d.resolve({ entryId: 'new' });
      expect(await p).toBe(true);
    });
    expect(latest.pending).toBe(false);
    expect(screen.getByTestId('n')).toHaveTextContent(String(before + 1));
  });

  it('reverts and toasts teacher/class names on clash', async () => {
    const err = new ApiError('clash', 'clash', {
      code: 'clash',
      conflicts: [
        { kind: 'teacher', id: T.perera, entryId: 'e-x' },
        { kind: 'class', id: C.c6b, entryId: 'e-y' },
      ],
    });
    const api: TimetableApi = { saveEntry: vi.fn().mockRejectedValue(err), deleteEntry: vi.fn() };
    setup(api);
    const before = entries6B.length;
    let ok = true;
    await act(async () => {
      ok = await latest.save(draft);
    });
    expect(ok).toBe(false);
    expect(screen.getByTestId('n')).toHaveTextContent(String(before));
    await waitFor(() => expect(screen.getByText(/Mrs\. N\. Perera/)).toBeInTheDocument());
    expect(screen.getByText(/6B/)).toBeInTheDocument();
  });

  it('shows generic toast on other errors', async () => {
    const api: TimetableApi = { saveEntry: vi.fn().mockRejectedValue(new ApiError('invalid', 'bad')), deleteEntry: vi.fn() };
    setup(api);
    await act(async () => {
      await latest.save(draft);
    });
    expect(screen.getByText(/Could not save/)).toBeInTheDocument();
  });

  it('optimistically removes and reverts on failure', async () => {
    const d = deferred<{ ok: true }>();
    const api: TimetableApi = { saveEntry: vi.fn(), deleteEntry: vi.fn(() => d.promise) };
    setup(api);
    const id = entries6B[0]!.id;
    let p!: Promise<boolean>;
    act(() => {
      p = latest.remove(id);
    });
    expect(screen.getByTestId('n')).toHaveTextContent(String(entries6B.length - 1));
    expect(api.deleteEntry).toHaveBeenCalledWith({ schoolId: ctx.school.id, yearId: 'y-2026', entryId: id });
    await act(async () => {
      d.reject(new ApiError('invalid', 'nope'));
      expect(await p).toBe(false);
    });
    expect(screen.getByTestId('n')).toHaveTextContent(String(entries6B.length));
  });
});
