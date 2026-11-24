// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, ReliefDay, SchoolContext, SnapshotCell, TeacherSnapshot, Year } from '@sathiya/core';
import { C, ctx as baseCtx, defaultTemplate, S, T } from '@sathiya/core/fixtures';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, call } from '../../lib/callable';
import { pickOption } from '../../test/pickOption';
import { renderWithSchool } from '../../test/renderWithSchool';
import { ReliefPage } from './ReliefPage';
import { useReliefDay, type ReliefDayState } from './useReliefDay';

vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));
vi.mock('./useReliefDay', () => ({ useReliefDay: vi.fn() }));

const TUE: DayIndex = 1;
const rows = defaultTemplate.rows;
const weekRows = { 0: rows, 1: rows, 2: rows, 3: rows, 4: rows } as TeacherSnapshot['rows'];

const cell = (entryId: string | undefined, period: number, start: string, end: string, classId: string, subjectId: string, title: string): SnapshotCell => ({
  day: TUE, period, start, end, title, sub: '', color: '', isGroup: false, ...(entryId ? { entryId } : {}), classIds: [classId], subjectId,
});
const snap = (teacherId: string, cells: SnapshotCell[]): TeacherSnapshot => ({
  teacherId, name: teacherId, staffId: teacherId, rows: weekRows, cells, yearLabel: '2026', schoolName: { nameEn: 'S' },
});

const pereraSnap = snap(T.perera, [
  cell('e1', 1, '07:45', '08:30', C.c6a, S.maths, '6A'),
  cell('e2', 3, '09:10', '09:50', C.c6b, S.maths, '6B'),
  cell('e3', 6, '11:30', '12:10', C.c6a, S.science, '6A'),
]);
const bandaraSnap = snap(T.bandara, [cell('b1', 3, '09:10', '09:50', C.c6c, S.maths, '6C')]);

const year: Year = { id: 'y-2026', label: '2026', status: 'published' };
const ctx: SchoolContext = {
  ...baseCtx,
  school: { ...baseCtx.school, activeYearId: 'y-2026' },
  teachers: baseCtx.teachers.filter((t) => t.id === T.perera || t.id === T.bandara),
};

function state(o: Partial<ReliefDayState> = {}): ReliefDayState {
  return {
    doc: null,
    snaps: new Map([pereraSnap, bandaraSnap].map((s) => [s.teacherId, s])),
    stats: { counts: {} },
    notified: null,
    loading: false,
    ...o,
  };
}

function setup(route = '/s/siripura/admin/relief', c: SchoolContext = ctx) {
  renderWithSchool(<ReliefPage />, { ctx: c, years: [year], route, path: '/s/:sid/admin/relief' });
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

async function markMorning(user: ReturnType<typeof userEvent.setup>) {
  await pickOption(user, screen.getByRole('button', { name: /Add teacher/ }), /N\. Perera/);
  const card = screen.getByRole('group', { name: /Mrs\. N\. Perera/ });
  await user.click(within(card).getByRole('button', { name: 'Morning' }));
  return card;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-24T02:00:00Z'));
  vi.mocked(useReliefDay).mockReturnValue(state());
});

afterEach(() => vi.useRealTimers());

describe('relief page', () => {
  it('marks leave and ticks morning lessons', async () => {
    const user = setup();
    expect(useReliefDay).toHaveBeenCalledWith('siripura', 'y-2026', '2026-11-24');
    const card = await markMorning(user);
    expect(within(card).getByRole('button', { name: 'Morning' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(card).getByRole('checkbox', { name: /P1.*6A Mathematics/ })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: /P3.*6B Mathematics/ })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: /P6.*6A Science/ })).not.toBeChecked();
    await user.click(within(card).getByRole('checkbox', { name: /P6.*6A Science/ }));
    expect(screen.getAllByRole('button', { name: /^Relief for/ })).toHaveLength(3);
  });

  it('suggest fills slots and shows uncovered count', async () => {
    const user = setup();
    await markMorning(user);
    await user.click(screen.getByRole('button', { name: 'Suggest relief' }));
    expect(screen.getByRole('button', { name: /^Relief for P1/ })).toHaveTextContent('Mr. P. Bandara');
    expect(screen.getByRole('button', { name: /^Relief for P3/ })).toHaveTextContent('Uncovered');
    expect(screen.getByText('1 period without relief')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Relief for P1/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /Mr\. P\. Bandara/ })).toHaveTextContent('Teaches this subject');
    await user.click(within(dialog).getByRole('button', { name: /Leave uncovered/ }));
    expect(screen.getByText('2 periods without relief')).toBeInTheDocument();
  });

  it('save sends expectedUpdatedAt and shows queued summary', async () => {
    vi.mocked(call).mockResolvedValue({ updatedAt: 2000, queued: 1, skippedNoEmail: 0, uncovered: 1 });
    const saved: ReliefDay = { date: '2026-11-24', day: TUE, leaves: [], reliefs: [], names: {}, updatedAt: 1000, updatedBy: 'u' };
    vi.mocked(useReliefDay).mockReturnValue(state({ doc: saved }));
    const user = setup();
    expect(screen.getByRole('button', { name: 'Save & notify' })).toBeDisabled();
    await markMorning(user);
    await user.click(screen.getByRole('button', { name: 'Suggest relief' }));
    await user.click(screen.getByRole('button', { name: 'Save & notify' }));
    expect(call).toHaveBeenCalledWith('saveReliefDay', expect.objectContaining({
      schoolId: 'siripura',
      yearId: 'y-2026',
      date: '2026-11-24',
      expectedUpdatedAt: 1000,
      leaves: [{ teacherId: T.perera, type: 'morning', entryIds: ['e1', 'e2'] }],
    }));
    const req = vi.mocked(call).mock.calls[0]![1] as { reliefs: { entryId: string; reliefTeacherId: string | null }[] };
    expect(req.reliefs.map((r) => [r.entryId, r.reliefTeacherId])).toEqual([['e1', T.bandara], ['e2', null]]);
    expect(await screen.findByText(/1 teacher will be emailed/)).toBeInTheDocument();
    expect(screen.getByText(/1 uncovered/)).toBeInTheDocument();
  });

  it('sends its own save time when editing again before the doc catches up', async () => {
    vi.mocked(call).mockResolvedValue({ updatedAt: 2000, queued: 0, skippedNoEmail: 0, uncovered: 0 });
    const saved: ReliefDay = { date: '2026-11-24', day: TUE, leaves: [], reliefs: [], names: {}, updatedAt: 1000, updatedBy: 'u' };
    vi.mocked(useReliefDay).mockReturnValue(state({ doc: saved }));
    const user = setup();
    const card = await markMorning(user);
    await user.click(screen.getByRole('button', { name: 'Save & notify' }));
    await screen.findByText('No emails needed');
    expect(screen.getByRole('button', { name: 'Save & notify' })).toBeDisabled();
    await user.click(within(card).getByRole('checkbox', { name: /P3/ }));
    await user.click(screen.getByRole('button', { name: 'Save & notify' }));
    expect(vi.mocked(call).mock.calls.map((c) => (c[1] as { expectedUpdatedAt: number | null }).expectedUpdatedAt)).toEqual([1000, 2000]);
  });

  it('counts empty slots as without relief before suggesting', async () => {
    const user = setup();
    await markMorning(user);
    expect(screen.getByText('2 periods without relief')).toBeInTheDocument();
  });

  it('stale error asks to reload', async () => {
    vi.mocked(call).mockRejectedValue(new ApiError('stale', "Someone else changed today's relief; reload"));
    const user = setup();
    await markMorning(user);
    await user.click(screen.getByRole('button', { name: 'Save & notify' }));
    expect(await screen.findByText(/Someone else changed today's relief/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(screen.queryByRole('group', { name: /Mrs\. N\. Perera/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Someone else changed/)).not.toBeInTheDocument();
  });

  it('shows invalid-relief errors on their rows', async () => {
    vi.mocked(call).mockRejectedValue(new ApiError('invalid-relief', 'Relief has problems', { errors: [{ code: 'busy', entryId: 'e1', teacherId: T.bandara }] }));
    const user = setup();
    await markMorning(user);
    await user.click(screen.getByRole('button', { name: 'Suggest relief' }));
    await user.click(screen.getByRole('button', { name: 'Save & notify' }));
    const row = (await screen.findByText('This teacher is busy then')).closest('li')!;
    expect(within(row).getByRole('button', { name: /^Relief for P1/ })).toBeInTheDocument();
  });

  it('asks to republish when cells lack entryId', () => {
    vi.mocked(useReliefDay).mockReturnValue(state({ snaps: new Map([[T.perera, snap(T.perera, [cell(undefined, 1, '07:45', '08:30', C.c6a, S.maths, '6A')])]]) }));
    setup();
    expect(screen.getByText('Republish once to enable relief')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save & notify' })).not.toBeInTheDocument();
  });

  it('asks to publish when the active year is not published', () => {
    renderWithSchool(<ReliefPage />, { ctx, years: [{ ...year, status: 'draft' }], route: '/s/siripura/admin/relief', path: '/s/:sid/admin/relief' });
    expect(screen.getByText('Publish a timetable first')).toBeInTheDocument();
  });

  it('weekend shows no school today', () => {
    vi.setSystemTime(new Date('2026-11-28T02:00:00Z'));
    setup();
    expect(screen.getByText('No school today')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save & notify' })).not.toBeInTheDocument();
  });

  it('past date is read-only', () => {
    const past: ReliefDay = {
      date: '2026-11-20',
      day: 4,
      leaves: [{ teacherId: T.perera, type: 'full', entryIds: ['e9'] }],
      reliefs: [{ entryId: 'e9', absentTeacherId: T.perera, day: 4, period: 2, start: '08:30', end: '09:10', classIds: [C.c6a], subjectId: S.maths, reliefTeacherId: T.bandara }],
      names: {},
      updatedAt: 1,
      updatedBy: 'u',
    };
    vi.mocked(useReliefDay).mockReturnValue(state({ doc: past, notified: { sent: { [T.bandara]: { key: 'k', at: Date.parse('2026-11-20T02:05:00Z') } }, pending: {} } }));
    setup('/s/siripura/admin/relief?date=2026-11-20');
    expect(useReliefDay).toHaveBeenCalledWith('siripura', 'y-2026', '2026-11-20');
    expect(screen.getByText(/Fri 20 Nov/)).toBeInTheDocument();
    expect(screen.getByText('Mr. P. Bandara')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /N\. Perera/ })).toHaveTextContent('P2 · 08:30 · 6A Mathematics');
    expect(screen.getByText('Emailed 07:35')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save & notify' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suggest relief' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add teacher/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Print' })).toHaveAttribute('href', '/s/siripura/admin/print/relief/2026-11-20');
  });

  it('shows email status for relief teachers', () => {
    const saved: ReliefDay = {
      date: '2026-11-24', day: TUE,
      leaves: [{ teacherId: T.perera, type: 'morning', entryIds: ['e1'] }],
      reliefs: [{ entryId: 'e1', absentTeacherId: T.perera, day: TUE, period: 1, start: '07:45', end: '08:30', classIds: [C.c6a], subjectId: S.maths, reliefTeacherId: T.bandara }],
      names: {}, updatedAt: 5, updatedBy: 'u',
    };
    vi.mocked(useReliefDay).mockReturnValue(state({ doc: saved, notified: { sent: {}, pending: { [T.bandara]: 5 } } }));
    setup();
    expect(screen.getByText('Email pending')).toBeInTheDocument();
  });

  it('hides email status for an unsaved pick', async () => {
    const saved: ReliefDay = {
      date: '2026-11-24', day: TUE,
      leaves: [{ teacherId: T.perera, type: 'morning', entryIds: ['e1'] }],
      reliefs: [{ entryId: 'e1', absentTeacherId: T.perera, day: TUE, period: 1, start: '07:45', end: '08:30', classIds: [C.c6a], subjectId: S.maths, reliefTeacherId: null }],
      names: {}, updatedAt: 5, updatedBy: 'u',
    };
    vi.mocked(useReliefDay).mockReturnValue(state({ doc: saved, notified: { sent: {}, pending: { [T.bandara]: 5 } } }));
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Suggest relief' }));
    expect(screen.getByRole('button', { name: /^Relief for P1/ })).toHaveTextContent('Mr. P. Bandara');
    expect(screen.queryByText('Email pending')).not.toBeInTheDocument();
  });

  it('lists a relief whose lesson a republish removed and lets the save drop it', async () => {
    vi.mocked(call).mockResolvedValue({ updatedAt: 9, queued: 1, skippedNoEmail: 0, uncovered: 0 });
    const saved: ReliefDay = {
      date: '2026-11-24', day: TUE,
      leaves: [{ teacherId: T.perera, type: 'morning', entryIds: ['e1', 'gone'] }],
      reliefs: [
        { entryId: 'e1', absentTeacherId: T.perera, day: TUE, period: 1, start: '07:45', end: '08:30', classIds: [C.c6a], subjectId: S.maths, reliefTeacherId: T.bandara },
        { entryId: 'gone', absentTeacherId: T.perera, day: TUE, period: 2, start: '08:30', end: '09:10', classIds: [C.c6c], subjectId: S.science, reliefTeacherId: T.bandara },
      ],
      names: {}, updatedAt: 5, updatedBy: 'u',
    };
    vi.mocked(useReliefDay).mockReturnValue(state({ doc: saved }));
    const user = setup();
    const row = screen.getByText('No longer in the timetable').closest('li')!;
    expect(row).toHaveTextContent('P2 · 08:30 · 6C Science');
    expect(screen.getAllByRole('button', { name: /^Relief for/ })).toHaveLength(1);
    const save = screen.getByRole('button', { name: 'Save & notify' });
    expect(save).toBeEnabled();
    await user.click(save);
    const req = vi.mocked(call).mock.calls[0]![1] as { leaves: unknown; reliefs: { entryId: string; reliefTeacherId: string | null }[] };
    expect(req.leaves).toEqual([{ teacherId: T.perera, type: 'morning', entryIds: ['e1'] }]);
    expect(req.reliefs.map((r) => [r.entryId, r.reliefTeacherId])).toEqual([['e1', T.bandara]]);
  });

  it('follows the Colombo date when the day rolls over', () => {
    setup();
    expect(useReliefDay).toHaveBeenLastCalledWith('siripura', 'y-2026', '2026-11-24');
    vi.setSystemTime(new Date('2026-11-25T02:00:00Z'));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(useReliefDay).toHaveBeenLastCalledWith('siripura', 'y-2026', '2026-11-25');
    expect(screen.getByLabelText('Day')).toHaveValue('2026-11-25');
  });

  it('explains a save refused because the day has passed', async () => {
    vi.mocked(call).mockRejectedValue(new ApiError('invalid', "Only today's relief can be edited"));
    const user = setup();
    await markMorning(user);
    await user.click(screen.getByRole('button', { name: 'Save & notify' }));
    expect(await screen.findByText(/This day is over/)).toBeInTheDocument();
    expect(screen.queryByText(/Only today's relief can be edited/)).not.toBeInTheDocument();
  });

  it('shows no email for a teacher without email or account', () => {
    const saved: ReliefDay = {
      date: '2026-11-24', day: TUE,
      leaves: [{ teacherId: T.perera, type: 'morning', entryIds: ['e1'] }],
      reliefs: [{ entryId: 'e1', absentTeacherId: T.perera, day: TUE, period: 1, start: '07:45', end: '08:30', classIds: [C.c6a], subjectId: S.maths, reliefTeacherId: T.bandara }],
      names: {}, updatedAt: 5, updatedBy: 'u',
    };
    vi.mocked(useReliefDay).mockReturnValue(state({ doc: saved }));
    setup();
    expect(screen.getByText('No email')).toBeInTheDocument();
  });
});
