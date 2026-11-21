import { buildSnapshots, type TeacherSnapshot, type Year } from '@sathiya/core';
import { C, S, T, ctx as baseCtx, entries, entry } from '@sathiya/core/fixtures';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { ChangePasswordModal } from './ChangePasswordModal';
import { TodayPage } from './TodayPage';
import { WeekPage } from './WeekPage';

const year: Year = { id: 'y-2026', label: '2026', status: 'published' };
const ctx = { ...baseCtx, school: { ...baseCtx.school, activeYearId: year.id } };
const claims = (tid: string) => ({ sid: ctx.school.id, role: 'teacher' as const, tid });

function snapshotFor(tid: string, extra = entries): TeacherSnapshot {
  const found = buildSnapshots(ctx, extra, year).teachers.find((t) => t.teacherId === tid);
  if (!found) throw new Error('no snapshot');
  return found;
}

const wed0920 = () => new Date(2026, 10, 25, 9, 20);
const sat = () => new Date(2026, 10, 21, 10, 0);

afterEach(() => vi.useRealTimers());

describe('TodayPage', () => {
  it('shows P3 in the now card on Wednesday 09:20', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={{ loading: false, data: snapshotFor(T.perera) }} />, {
      ctx,
      claims: claims(T.perera),
    });
    const card = screen.getByTestId('now-card');
    expect(within(card).getByText(/P3/)).toBeInTheDocument();
    expect(within(card).getByText(/30 min left/)).toBeInTheDocument();
    expect(within(card).getByText(/Mathematics · 6B/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wed' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('on Saturday shows No classes today with Monday list', () => {
    renderWithSchool(<TodayPage now={sat} snapshot={{ loading: false, data: snapshotFor(T.perera) }} />, {
      ctx,
      claims: claims(T.perera),
    });
    expect(screen.getByText('No classes today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('period-1')).toHaveTextContent('6B');
  });

  it('shows the not-published empty state without an active year', () => {
    renderWithSchool(<TodayPage now={wed0920} />, {
      ctx: { ...baseCtx, school: { ...baseCtx.school, activeYearId: undefined } },
      claims: claims(T.perera),
    });
    expect(screen.getByText('Not published yet')).toBeInTheDocument();
  });

  it('shows the empty state when the snapshot doc is missing', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={{ loading: false }} />, { ctx, claims: claims(T.perera) });
    expect(screen.getByText('Not published yet')).toBeInTheDocument();
  });

  it('refreshes now every 30 seconds', () => {
    vi.useFakeTimers();
    let current = new Date(2026, 10, 25, 9, 20);
    renderWithSchool(<TodayPage now={() => current} snapshot={{ loading: false, data: snapshotFor(T.perera) }} />, {
      ctx,
      claims: claims(T.perera),
    });
    expect(screen.getByText(/30 min left/)).toBeInTheDocument();
    current = new Date(2026, 10, 25, 9, 40);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText(/10 min left/)).toBeInTheDocument();
  });

  it('uses Sinhala subject names when lang is si', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={{ loading: false, data: snapshotFor(T.perera) }} />, {
      ctx,
      claims: claims(T.perera),
      lang: 'si',
    });
    const si = ctx.subjects.find((s) => s.id === S.maths)?.nameSi;
    expect(si).toBeTruthy();
    expect(within(screen.getByTestId('now-card')).getAllByText(new RegExp(si as string)).length).toBeGreaterThan(0);
  });
});

describe('WeekPage', () => {
  it('renders both cells of a default row holding two class templates', () => {
    const extra = [
      ...entries,
      entry('x-1a-0-5', 0, 5, [C.c1a], [[S.maths, T.wickramasinghe]]),
      entry('x-1a-0-6', 0, 6, [C.c1a], [[S.sinhala, T.wickramasinghe]]),
    ];
    const snap = snapshotFor(T.wickramasinghe, extra);
    const row5 = snap.cells.filter((c) => c.day === 0 && c.period === 5);
    expect(row5).toHaveLength(2);
    renderWithSchool(<WeekPage now={wed0920} snapshot={{ loading: false, data: snap }} />, {
      ctx,
      claims: claims(T.wickramasinghe),
    });
    const cell = screen.getByTestId('week-cell-0-5');
    expect(within(cell).getAllByText('1A')).toHaveLength(2);
  });
});

describe('WeekPage per-day templates', () => {
  it('keeps lessons from a day with more periods than another day', () => {
    const base = snapshotFor(T.perera);
    const row = (type: 'period' | 'interval', start: string, end: string) => ({ type, start, end });
    const short = [row('period', '07:45', '08:30'), row('period', '08:30', '09:10'), row('interval', '09:10', '09:30'), row('period', '09:30', '10:10')];
    const long = [row('period', '07:45', '08:30'), row('period', '08:30', '09:10'), row('period', '09:10', '09:50'), row('period', '09:50', '10:30')];
    const snap: TeacherSnapshot = {
      ...base,
      rows: { 0: short, 1: short, 2: short, 3: long, 4: short },
      cells: [{ day: 3, period: 4, start: '09:50', end: '10:30', title: '7A', sub: 'Science', color: '', isGroup: false }],
    };
    renderWithSchool(<WeekPage now={wed0920} snapshot={{ loading: false, data: snap }} />, { ctx, claims: claims(T.perera) });
    expect(within(screen.getByTestId('week-cell-3-4')).getByText('7A')).toBeInTheDocument();
  });
});

describe('ChangePasswordModal', () => {
  const fill = async (cur: string, next: string, confirm: string) => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Current password'), cur);
    await user.type(screen.getByLabelText('New password'), next);
    await user.type(screen.getByLabelText('Confirm new password'), confirm);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
  };

  it('calls the injected function with current and new password', async () => {
    const change = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithSchool(<ChangePasswordModal open onClose={onClose} changePassword={change} />, { ctx });
    await fill('oldpass', 'newpass1', 'newpass1');
    await waitFor(() => expect(change).toHaveBeenCalledWith('oldpass', 'newpass1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows a mismatch error and does not call', async () => {
    const change = vi.fn();
    renderWithSchool(<ChangePasswordModal open onClose={() => undefined} changePassword={change} />, { ctx });
    await fill('oldpass', 'newpass1', 'different');
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 6 characters', async () => {
    const change = vi.fn();
    renderWithSchool(<ChangePasswordModal open onClose={() => undefined} changePassword={change} />, { ctx });
    await fill('oldpass', 'abc', 'abc');
    expect(await screen.findByText('Use at least 6 characters')).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it('shows an error when the current password is wrong', async () => {
    const change = vi.fn().mockRejectedValue({ code: 'auth/invalid-credential' });
    renderWithSchool(<ChangePasswordModal open onClose={() => undefined} changePassword={change} />, { ctx });
    await fill('oldpass', 'newpass1', 'newpass1');
    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
  });
});
