// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { buildSnapshots, type TeacherSnapshot, type Year } from '@sathiya/core';
import { C, S, T, ctx as baseCtx, entries, entry } from '@sathiya/core/fixtures';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LangContextProvider } from '../../app/LangProvider';
import { renderWithSchool } from '../../test/renderWithSchool';
import tailwindConfig from '../../../tailwind.config';
import { colomboNow } from './colomboNow';
import { TodayPage } from './TodayPage';
import { WeekPage } from './WeekPage';
import { recordSignInOnce } from './signIn';

vi.mock('./signIn');

const year: Year = { id: 'y-2026', label: '2026', status: 'published' };
const ctx = { ...baseCtx, school: { ...baseCtx.school, activeYearId: year.id } };
const claims = (tid: string, r: 'a' | 't' = 't') => ({ schools: { [ctx.school.id]: { r, t: tid } } });

function snapshotFor(tid: string, extra = entries): TeacherSnapshot {
  const found = buildSnapshots(ctx, extra, year).teachers.find((t) => t.teacherId === tid);
  if (!found) throw new Error('no snapshot');
  return found;
}

const wed0920 = () => new Date('2026-11-25T03:50:00Z');
const sat = () => new Date('2026-11-21T04:30:00Z');

afterEach(() => vi.useRealTimers());

describe('colomboNow', () => {
  it('maps an instant to Colombo wall-clock fields', () => {
    const d = colomboNow(new Date('2026-11-25T03:50:00Z'));
    expect([d.getDay(), d.getHours(), d.getMinutes()]).toEqual([3, 9, 20]);
  });

  it('rolls Friday 20:00Z into Saturday', () => {
    const d = colomboNow(new Date('2026-11-20T20:00:00Z'));
    expect([d.getDay(), d.getHours(), d.getMinutes()]).toEqual([6, 1, 30]);
  });
});

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
    let current = new Date('2026-11-25T03:50:00Z');
    renderWithSchool(<TodayPage now={() => current} snapshot={{ loading: false, data: snapshotFor(T.perera) }} />, {
      ctx,
      claims: claims(T.perera),
    });
    expect(screen.getByText(/30 min left/)).toBeInTheDocument();
    current = new Date('2026-11-25T04:10:00Z');
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
    expect(screen.getByText('Mrs. N. Perera · SCC024')).toBeInTheDocument();
  });

  it('shows the date line in the active language', () => {
    const { unmount } = renderWithSchool(<TodayPage now={wed0920} snapshot={{ loading: false, data: snapshotFor(T.perera) }} />, {
      ctx,
      claims: claims(T.perera),
      lang: 'si',
    });
    expect(screen.getByText('බදාදා 25 නොවැම්බර්')).toBeInTheDocument();
    unmount();
    renderWithSchool(<TodayPage now={wed0920} snapshot={{ loading: false, data: snapshotFor(T.perera) }} />, {
      ctx,
      claims: claims(T.perera),
    });
    expect(screen.getByText('Wednesday 25 November')).toBeInTheDocument();
  });
});

describe('TeacherFrame chrome', () => {
  const snap = () => ({ loading: false, data: snapshotFor(T.perera) });

  it('links back to the school admin for an admin who teaches', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={snap()} />, { ctx, claims: claims(T.perera, 'a') });
    expect(screen.getByRole('link', { name: 'School admin' })).toHaveAttribute('href', `/s/${ctx.school.id}/admin`);
  });

  it('links the Today and Week tabs under the school', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={snap()} />, { ctx, claims: claims(T.perera) });
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', `/s/${ctx.school.id}/me`);
    expect(screen.getByRole('link', { name: 'Week' })).toHaveAttribute('href', `/s/${ctx.school.id}/me/week`);
  });

  it('has no change-password button', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={snap()} />, { ctx, claims: claims(T.perera) });
    expect(screen.queryByRole('button', { name: 'Change password' })).toBeNull();
  });

  it('shows no badge in place of a missing logo', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={snap()} />, { ctx, claims: claims(T.perera) });
    expect(screen.queryByTestId('school-logo')).toBeNull();
    expect(screen.queryByText(ctx.school.staffPrefix)).toBeNull();
  });

  it('shows the uploaded logo', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={snap()} />, { ctx: { ...ctx, school: { ...ctx.school, logoUrl: 'https://example.test/logo.png' } }, claims: claims(T.perera) });
    expect(screen.getByTestId('school-logo')).toHaveAttribute('src', 'https://example.test/logo.png');
  });

  it('records the sign-in once the teacher frame loads', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={snap()} />, { ctx, claims: claims(T.perera) });
    expect(recordSignInOnce).toHaveBeenCalled();
  });

  it('hides the admin link for a plain teacher', () => {
    renderWithSchool(<TodayPage now={wed0920} snapshot={snap()} />, { ctx, claims: claims(T.perera) });
    expect(screen.queryByRole('link', { name: 'School admin' })).toBeNull();
  });

  it('toggles language with a translated, descriptive label', async () => {
    const setLang = vi.fn();
    renderWithSchool(
      <LangContextProvider value={{ lang: 'en', setLang }}>
        <TodayPage now={wed0920} snapshot={snap()} />
      </LangContextProvider>,
      { ctx, claims: claims(T.perera) },
    );
    const btn = screen.getByRole('button', { name: 'Language: සිංහල' });
    expect(btn).toHaveTextContent('සිං');
    await userEvent.click(btn);
    expect(setLang).toHaveBeenCalledWith('si');
  });

  it('keeps the on-brand colour token alpha-capable', () => {
    const colors = tailwindConfig.theme?.extend?.colors as unknown as Record<string, string>;
    expect(colors['on-brand']).toContain('<alpha-value>');
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

  it('wraps Sinhala subject names instead of truncating them', () => {
    renderWithSchool(<WeekPage now={wed0920} snapshot={{ loading: false, data: snapshotFor(T.perera) }} />, {
      ctx,
      claims: claims(T.perera),
      lang: 'si',
    });
    const si = ctx.subjects.find((s) => s.id === S.maths)?.nameSi as string;
    const name = within(screen.getByTestId('week-cell-2-3')).getByText(si);
    expect(name).not.toHaveClass('truncate');
    expect(name).toHaveClass('break-words');
  });
});

describe('combined classes', () => {
  it('shows the joined class names on the week grid', () => {
    const extra = [...entries, entry('x-comb', 0, 5, [C.c6a, C.c6b], [[S.maths, T.wickramasinghe]])];
    const snap = snapshotFor(T.wickramasinghe, extra);
    renderWithSchool(<WeekPage now={wed0920} snapshot={{ loading: false, data: snap }} />, { ctx, claims: claims(T.wickramasinghe) });
    expect(within(screen.getByTestId('week-cell-0-5')).getByText('6A+6B')).toBeInTheDocument();
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

describe('activity rows', () => {
  const act = (start: string, end: string, nameEn: string) => ({ type: 'activity' as const, start, end, nameEn });
  const row = (type: 'period', start: string, end: string) => ({ type, start, end });
  const rows = [act('07:30', '07:45', 'Assembly'), row('period', '07:45', '08:30'), act('08:30', '08:45', 'School meal'), row('period', '08:45', '09:30')];

  it('names activity rows on the week and today views, including before period 1', () => {
    const snap: TeacherSnapshot = { ...snapshotFor(T.perera), rows: { 0: rows, 1: rows, 2: rows, 3: rows, 4: rows }, cells: [] };
    const props = { snapshot: { loading: false, data: snap } };
    const week = renderWithSchool(<WeekPage now={wed0920} {...props} />, { ctx, claims: claims(T.perera) });
    expect(screen.getByText(/Assembly/)).toBeInTheDocument();
    expect(screen.getByText(/School meal/)).toBeInTheDocument();
    week.unmount();
    renderWithSchool(<TodayPage now={wed0920} {...props} />, { ctx, claims: claims(T.perera) });
    expect(screen.getByText(/Assembly · 7:30/)).toBeInTheDocument();
  });

  it('does not name an activity that only some weekdays have', () => {
    const only = { 0: rows, 1: rows.slice(1), 2: rows.slice(1), 3: rows.slice(1), 4: rows.slice(1) };
    const snap: TeacherSnapshot = { ...snapshotFor(T.perera), rows: only, cells: [] };
    renderWithSchool(<WeekPage now={wed0920} snapshot={{ loading: false, data: snap }} />, { ctx, claims: claims(T.perera) });
    expect(screen.queryByText(/Assembly/)).toBeNull();
  });
});
