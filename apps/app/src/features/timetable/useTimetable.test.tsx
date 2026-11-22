// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { renderWithSchool } from '../../test/renderWithSchool';
import { ApiError } from '../../lib/callable';
import { C, ctx, entries6B, S, T } from '@sathiya/core/fixtures';
import type { EntryDraft } from '@sathiya/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { useState, type ReactNode } from 'react';
import { SchoolContextProvider } from '../../app/SchoolProvider';
import { testI18n } from '../../test/render';
import { ToastProvider } from '../../ui/Toast';
import type { Entry } from '@sathiya/core';
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

  it('keeps an edited entry visible when the save changes nothing on the server', async () => {
    const api: TimetableApi = { saveEntry: vi.fn(async (req) => ({ entryId: req.entry.id! })), deleteEntry: vi.fn() };
    setup(api);
    const existing = entries6B[0]!;
    const same: EntryDraft = { id: existing.id, day: existing.day, period: existing.period, classIds: existing.classIds, lessons: existing.lessons };
    await act(async () => {
      expect(await latest.save(same)).toBe(true);
    });
    expect(latest.entries.filter((e) => e.id === existing.id)).toHaveLength(1);
    expect(latest.entries).toHaveLength(entries6B.length);
    expect(api.deleteEntry).not.toHaveBeenCalled();
  });

  it('replacing the teacher saves the same entry id once', async () => {
    const api: TimetableApi = { saveEntry: vi.fn(async (req) => ({ entryId: req.entry.id! })), deleteEntry: vi.fn() };
    setup(api);
    const existing = entries6B[0]!;
    const changed: EntryDraft = { id: existing.id, day: existing.day, period: existing.period, classIds: existing.classIds, lessons: [{ ...existing.lessons[0]!, teacherId: T.ananda }] };
    await act(async () => {
      await latest.save(changed);
    });
    expect(api.saveEntry).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.saveEntry).mock.calls[0]![0].entry.id).toBe(existing.id);
    expect(api.deleteEntry).not.toHaveBeenCalled();
    expect(latest.entries.filter((e) => e.id === existing.id)).toHaveLength(1);
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

  describe('snapshot ordering', () => {
    let setServer!: (e: Entry[]) => void;
    function Live({ api, children }: { api: TimetableApi; children: ReactNode }) {
      const [server, set] = useState<Entry[]>(entries6B);
      setServer = set;
      return (
        <I18nextProvider i18n={testI18n}>
          <ToastProvider>
            <SchoolContextProvider
              school={{ ...ctx, loading: false }}
              year={{ years: [], yearId: 'y-2026', setYearId: () => undefined, entries: server, loading: false }}
            >
              <TimetableApiContext.Provider value={api}>{children}</TimetableApiContext.Provider>
            </SchoolContextProvider>
          </ToastProvider>
        </I18nextProvider>
      );
    }
    const serverCopy: Entry = { id: 'srv-1', day: 0, period: 8, classIds: [C.c6b], lessons: draft.lessons, teacherIds: [T.perera] };

    it('no duplicate when the server copy differs from the optimistic one', async () => {
      const d = deferred<{ entryId: string }>();
      const api: TimetableApi = { saveEntry: vi.fn(() => d.promise), deleteEntry: vi.fn() };
      render(<Live api={api}><Probe /></Live>);
      let p!: Promise<boolean>;
      act(() => {
        p = latest.save(draft);
      });
      act(() => setServer([...entries6B, { ...serverCopy, groupKey: 'normalised' }]));
      await act(async () => {
        d.resolve({ entryId: 'srv-1' });
        await p;
      });
      expect(latest.entries.filter((e) => e.id === 'srv-1' || e.id.startsWith('tmp-'))).toHaveLength(1);
    });

    it('no duplicate when snapshot arrives before the callable resolves', async () => {
      const d = deferred<{ entryId: string }>();
      const api: TimetableApi = { saveEntry: vi.fn(() => d.promise), deleteEntry: vi.fn() };
      render(<Live api={api}><Probe /></Live>);
      let p!: Promise<boolean>;
      act(() => {
        p = latest.save(draft);
      });
      act(() => setServer([...entries6B, serverCopy]));
      await act(async () => {
        d.resolve({ entryId: 'srv-1' });
        await p;
      });
      expect(latest.entries.filter((e) => e.id === 'srv-1' || e.id.startsWith('tmp-'))).toHaveLength(1);
      expect(latest.entries.some((e) => e.id.startsWith('tmp-'))).toBe(false);
    });

    it('no duplicate while the callable is still in flight after the snapshot', async () => {
      const d = deferred<{ entryId: string }>();
      const api: TimetableApi = { saveEntry: vi.fn(() => d.promise), deleteEntry: vi.fn() };
      render(<Live api={api}><Probe /></Live>);
      let p!: Promise<boolean>;
      act(() => {
        p = latest.save(draft);
      });
      act(() => setServer([...entries6B, serverCopy]));
      expect(latest.entries).toHaveLength(entries6B.length + 1);
      expect(latest.entries.some((e) => e.id === 'srv-1')).toBe(true);
      await act(async () => {
        d.resolve({ entryId: 'srv-1' });
        await p;
      });
      expect(latest.entries).toHaveLength(entries6B.length + 1);
    });

    it('no duplicate when callable resolves before the snapshot', async () => {
      const api: TimetableApi = { saveEntry: vi.fn().mockResolvedValue({ entryId: 'srv-1' }), deleteEntry: vi.fn() };
      render(<Live api={api}><Probe /></Live>);
      await act(async () => {
        await latest.save(draft);
      });
      expect(latest.entries).toHaveLength(entries6B.length + 1);
      act(() => setServer([...entries6B, serverCopy]));
      expect(latest.entries).toHaveLength(entries6B.length + 1);
      expect(latest.entries.some((e) => e.id.startsWith('tmp-'))).toBe(false);
    });

    it('removing an unsettled temp entry cancels the save once it resolves', async () => {
      const d = deferred<{ entryId: string }>();
      const api: TimetableApi = { saveEntry: vi.fn(() => d.promise), deleteEntry: vi.fn() };
      render(<Live api={api}><Probe /></Live>);
      act(() => {
        void latest.save(draft);
      });
      const tmp = latest.entries.find((e) => e.id.startsWith('tmp-'))!;
      await act(async () => {
        await latest.remove(tmp.id);
      });
      expect(api.deleteEntry).not.toHaveBeenCalled();
      expect(latest.entries).toHaveLength(entries6B.length);
      const del = deferred<{ ok: true }>();
      (api.deleteEntry as ReturnType<typeof vi.fn>).mockReturnValue(del.promise);
      await act(async () => {
        d.resolve({ entryId: 'srv-1' });
      });
      expect(api.deleteEntry).toHaveBeenCalledWith({ schoolId: ctx.school.id, yearId: 'y-2026', entryId: 'srv-1' });
      act(() => setServer([...entries6B, serverCopy]));
      expect(latest.entries.some((e) => e.id === 'srv-1')).toBe(false);
      await act(async () => {
        del.resolve({ ok: true });
      });
      act(() => setServer(entries6B));
      expect(latest.entries).toHaveLength(entries6B.length);
    });

    it('removing the server copy while the save is in flight does not bring the lesson back', async () => {
      const d = deferred<{ entryId: string }>();
      const del = deferred<{ ok: true }>();
      const api: TimetableApi = { saveEntry: vi.fn(() => d.promise), deleteEntry: vi.fn(() => del.promise) };
      render(<Live api={api}><Probe /></Live>);
      let p!: Promise<boolean>;
      act(() => {
        p = latest.save(draft);
      });
      act(() => setServer([...entries6B, serverCopy]));
      act(() => {
        void latest.remove('srv-1');
      });
      expect(latest.entries).toHaveLength(entries6B.length);
      await act(async () => {
        d.resolve({ entryId: 'srv-1' });
        await p;
      });
      expect(latest.entries).toHaveLength(entries6B.length);
      await act(async () => {
        del.resolve({ ok: true });
      });
      act(() => setServer(entries6B));
      expect(latest.entries).toHaveLength(entries6B.length);
      expect(api.deleteEntry).toHaveBeenCalledTimes(1);
    });

    it('no ghost when the delete snapshot lands before the save callable returns', async () => {
      const d = deferred<{ entryId: string }>();
      const api: TimetableApi = { saveEntry: vi.fn(() => d.promise), deleteEntry: vi.fn().mockResolvedValue({ ok: true }) };
      render(<Live api={api}><Probe /></Live>);
      let p!: Promise<boolean>;
      act(() => {
        p = latest.save(draft);
      });
      act(() => setServer([...entries6B, serverCopy]));
      await act(async () => {
        await latest.remove('srv-1');
      });
      act(() => setServer(entries6B));
      expect(latest.entries).toHaveLength(entries6B.length);
      await act(async () => {
        d.resolve({ entryId: 'srv-1' });
        await p;
      });
      expect(latest.entries).toHaveLength(entries6B.length);
      expect(latest.entries.some((e) => e.id.startsWith('tmp-') || e.id === 'srv-1')).toBe(false);
      expect(api.deleteEntry).toHaveBeenCalledTimes(1);
    });

    it('no error toast when a save fails for an already removed temp entry', async () => {
      const d = deferred<{ entryId: string }>();
      const api: TimetableApi = { saveEntry: vi.fn(() => d.promise), deleteEntry: vi.fn() };
      render(<Live api={api}><Probe /></Live>);
      let p!: Promise<boolean>;
      act(() => {
        p = latest.save(draft);
      });
      await act(async () => {
        await latest.remove(latest.entries.find((e) => e.id.startsWith('tmp-'))!.id);
        d.reject(new ApiError('invalid', 'bad'));
        await p;
      });
      expect(screen.queryByText(/Could not save/)).toBeNull();
      expect(api.deleteEntry).not.toHaveBeenCalled();
    });
  });
});
