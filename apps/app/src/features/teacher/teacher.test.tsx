// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { buildSnapshots, type ClassSnapshot, type SchoolContext, type ReliefDay, type SchoolClass, type Teacher, type TeacherSnapshot, type Year } from '@sathiya/core';
import { C, S, T, ctx as baseCtx, entries, entry } from '@sathiya/core/fixtures';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onSnapshot } from 'firebase/firestore';
import { useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import tailwindConfig from '../../../tailwind.config';
import { LangContextProvider } from '../../app/LangProvider';
import { call } from '../../lib/callable';
import { installMatchMedia, resizeTo } from '../../test/matchMedia';
import { renderWithSchool } from '../../test/renderWithSchool';
import { colomboNow } from './colomboNow';
import { MePage, meStats } from './MePage';
import { overlayRelief } from './reliefOverlay';
import { MyClassPage } from './MyClassPage';
import { recordSignInOnce } from './signIn';
import { TeacherShell, type TeacherShellProps } from './TeacherShell';
import { TimetablePage } from './TimetablePage';
import { TodayPage } from './TodayPage';

vi.mock('./signIn');
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn(() => new Promise(() => undefined)) }));
vi.mock('firebase/firestore', async (orig) => ({ ...(await orig<typeof import('firebase/firestore')>()), onSnapshot: vi.fn(() => () => undefined) }));
afterEach(() => {
  const listeners = vi.mocked(onSnapshot).mock.calls.length;
  vi.mocked(onSnapshot).mockClear();
  expect(listeners).toBe(0);
});

const year: Year = { id: 'y-2026', label: '2026', status: 'published' };
const ctx = { ...baseCtx, school: { ...baseCtx.school, activeYearId: year.id } };
const sid = ctx.school.id;
const claims = (tid: string, r: 'a' | 't' = 't') => ({ schools: { [sid]: { r, t: tid } } });
const built = buildSnapshots(ctx, entries, year);
const snapshotFor = (tid: string, extra = entries): TeacherSnapshot => {
  const found = buildSnapshots(ctx, extra, year).teachers.find((t) => t.teacherId === tid);
  if (!found) throw new Error('no snapshot');
  return found;
};
const class6B = built.classes.find((c) => c.classId === C.c6b)!;
const cls6B = ctx.classes.find((c) => c.id === C.c6b)!;

// Wednesday 25 November 2026, 09:20 in Colombo: Mrs. N. Perera teaches 6B Maths in P3.
const wed0920 = () => new Date('2026-11-25T03:50:00Z');
const fri0920 = () => new Date('2026-11-27T03:50:00Z');
const sat = () => new Date('2026-11-21T04:30:00Z');
const WED = '2026-11-25';
const THU = '2026-11-26';

const names = { [T.rSilva]: { en: 'Mr. R. Silva' }, [T.perera]: { en: 'Mrs. N. Perera' }, [T.wijesekara]: { en: 'Ms. A. Wijesekara' } };
const wedRelief: ReliefDay = {
  date: WED,
  day: 2,
  leaves: [{ teacherId: T.rSilva, type: 'full', entryIds: ['e-6b-2-6', 'e-6b-2-8'] }],
  reliefs: [
    { entryId: 'e-6b-2-6', absentTeacherId: T.rSilva, day: 2, period: 6, start: '11:30', end: '12:10', classIds: [C.c6b], subjectId: S.sinhala, reliefTeacherId: T.perera },
    { entryId: 'e-6b-2-8', absentTeacherId: T.rSilva, day: 2, period: 8, start: '12:50', end: '13:30', classIds: [C.c6b], subjectId: S.history, reliefTeacherId: null },
  ],
  names,
  labels: { [`e-6b-2-6|${T.rSilva}`]: { cls: '6B', sub: 'Sinhala' }, [`e-6b-2-8|${T.rSilva}`]: { cls: '6B', sub: 'History' } },
  updatedAt: 1,
  updatedBy: 'u',
};
const thuRelief: ReliefDay = {
  date: THU,
  day: 3,
  leaves: [{ teacherId: T.wijesekara, type: 'full', entryIds: ['e-6b-3-5'] }],
  reliefs: [{ entryId: 'e-6b-3-5', absentTeacherId: T.wijesekara, day: 3, period: 5, start: '10:50', end: '11:30', classIds: [C.c6b], subjectId: S.english, reliefTeacherId: T.perera }],
  names,
  labels: { [`e-6b-3-5|${T.wijesekara}`]: { cls: '6B', sub: 'English' } },
  updatedAt: 1,
  updatedBy: 'u',
};

const pereraRecord: Teacher = { ...ctx.teachers.find((t) => t.id === T.perera)!, email: 'n.perera@siripura.example.com', phone: '071 234 5678' };

interface Opts extends Partial<TeacherShellProps> {
  tid?: string;
  role?: 'a' | 't';
  lang?: 'en' | 'si';
  ctx?: SchoolContext;
  route?: string;
}

function renderTeacher(page: ReactElement, { tid = T.perera, role = 't', lang, ctx: c = ctx, route = `/s/${sid}/me`, ...props }: Opts = {}) {
  const shell: TeacherShellProps = {
    now: wed0920,
    snapshot: { loading: false, data: snapshotFor(tid) },
    reliefDays: {},
    classes: tid === T.perera ? [cls6B] : [],
    classSnapshots: { [C.c6b]: class6B },
    teacher: { loading: false, data: pereraRecord },
    ...props,
  };
  return renderWithSchool(<TeacherShell {...shell}>{page}</TeacherShell>, { ctx: c, route, claims: claims(tid, role), ...(lang && { lang }) });
}

let restoreMedia: (() => void) | undefined;
const asPhone = () => {
  restoreMedia = installMatchMedia(390);
};
beforeEach(() => {
  restoreMedia = installMatchMedia(1280);
});
afterEach(() => {
  restoreMedia?.();
  vi.useRealTimers();
});

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

describe('Today', () => {
  it('shows P3 in the now card on Wednesday 09:20, with the greeting and date', () => {
    renderTeacher(<TodayPage />);
    const card = screen.getByTestId('now-card');
    expect(within(card).getByText(/P3/)).toBeInTheDocument();
    expect(within(card).getByText(/30 min left/)).toBeInTheDocument();
    expect(within(card).getByText(/Mathematics · 6B/)).toBeInTheDocument();
    expect(within(card).getByText(/P4 · Mathematics · 6A/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Good morning, Mrs. N. Perera' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday 25 November')).toBeInTheDocument();
  });

  it('on a phone lists relief today, the rest of the day and tomorrow’s planned relief', () => {
    asPhone();
    renderTeacher(<TodayPage />, { reliefDays: { [WED]: wedRelief, [THU]: thuRelief } });
    const relief = screen.getByRole('region', { name: /Relief today/ });
    expect(relief).toHaveTextContent('6B · Sinhala');
    expect(relief).toHaveTextContent('Covering for Mr. R. Silva');
    const rest = screen.getByRole('region', { name: 'Rest of today' });
    expect(rest).toHaveTextContent('6A · Mathematics');
    expect(rest).not.toHaveTextContent('6B · Sinhala');
    expect(screen.getByText(/1 relief period/).closest('div')).toHaveTextContent('Tomorrow: 1 relief period planned');
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', `/s/${sid}/me/timetable`);
    expect(screen.queryByRole('region', { name: 'This week' })).toBeNull();
  });

  it('hides relief sections when nothing is planned', () => {
    asPhone();
    renderTeacher(<TodayPage />);
    expect(screen.queryByRole('region', { name: /Relief today/ })).toBeNull();
    expect(screen.queryByText(/relief period/)).toBeNull();
  });

  it('on a desktop puts the week beside now and relief, and names Monday after a Friday', () => {
    renderTeacher(<TodayPage />, { now: fri0920, reliefDays: { '2026-11-30': { ...thuRelief, date: '2026-11-30', day: 0, reliefs: [{ ...thuRelief.reliefs[0]!, day: 0 }] } } });
    const week = screen.getByRole('region', { name: 'This week' });
    expect(within(week).getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    expect(within(week).getByRole('link', { name: 'Print' })).toHaveAttribute('href', `/s/${sid}/me/print/timetable?auto=1`);
    expect(within(week).getByRole('table')).toBeInTheDocument();
    const monday = screen.getByRole('region', { name: /^Monday/ });
    expect(monday).toHaveTextContent('Covering for Ms. A. Wijesekara');
  });

  it('on Saturday says there are no classes today', () => {
    renderTeacher(<TodayPage />, { now: sat });
    expect(screen.getByText('No classes today')).toBeInTheDocument();
  });

  it('shows the not-published state without an active year', () => {
    const { activeYearId: _unused, ...noYear } = ctx.school;
    renderTeacher(<TodayPage />, { ctx: { ...ctx, school: noYear }, snapshot: undefined });
    expect(screen.getByText('Not published yet')).toBeInTheDocument();
  });

  it('shows the not-published state when the snapshot doc is missing', () => {
    renderTeacher(<TodayPage />, { snapshot: { loading: false } });
    expect(screen.getByText('Not published yet')).toBeInTheDocument();
  });

  it('refreshes now every 30 seconds', () => {
    vi.useFakeTimers();
    let current = new Date('2026-11-25T03:50:00Z');
    renderTeacher(<TodayPage />, { now: () => current });
    expect(screen.getByText(/30 min left/)).toBeInTheDocument();
    current = new Date('2026-11-25T04:10:00Z');
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText(/10 min left/)).toBeInTheDocument();
  });

  it('uses Sinhala subject names and date when lang is si', () => {
    renderTeacher(<TodayPage />, { lang: 'si' });
    const si = ctx.subjects.find((s) => s.id === S.maths)?.nameSi;
    expect(within(screen.getByTestId('now-card')).getAllByText(new RegExp(si as string)).length).toBeGreaterThan(0);
    expect(screen.getByText('බදාදා 25 නොවැම්බර්')).toBeInTheDocument();
  });

  it('keeps the leave note on the now card: who covers, or that nobody does', () => {
    const lesson = snapshotFor(T.perera).cells.find((c) => c.day === 2 && c.period === 3)!;
    const leave = (reliefTeacherId: string | null): ReliefDay => ({
      ...wedRelief,
      leaves: [{ teacherId: T.perera, type: 'full', entryIds: [lesson.entryId!] }],
      reliefs: [{ entryId: lesson.entryId!, absentTeacherId: T.perera, day: 2, period: 3, start: '09:10', end: '09:50', classIds: [C.c6b], subjectId: S.maths, reliefTeacherId }],
    });
    const { unmount } = renderTeacher(<TodayPage />, { reliefDays: { [WED]: leave(T.wijesekara) } });
    expect(screen.getByTestId('now-card')).toHaveTextContent('On leave · relief: Ms. A. Wijesekara');
    unmount();
    renderTeacher(<TodayPage />, { reliefDays: { [WED]: leave(null) } });
    expect(screen.getByTestId('now-card')).toHaveTextContent('On leave · no relief');
  });

  it('goes back to the current week when Week is picked after moving days', async () => {
    renderTeacher(<TodayPage />);
    const week = screen.getByRole('region', { name: 'This week' });
    await userEvent.click(within(week).getByRole('radio', { name: 'Day' }));
    for (let i = 0; i < 3; i++) await userEvent.click(within(week).getByRole('button', { name: 'Later' }));
    expect(within(week).getAllByText('Monday 30 November').length).toBeGreaterThan(0);
    await userEvent.click(within(week).getByRole('radio', { name: 'Week' }));
    expect(within(week).getByText('This week')).toBeInTheDocument();
    expect(within(week).getByTestId(`cell-${WED}-3`)).toHaveTextContent('6B');
    expect(within(week).queryByTestId('cell-2026-11-30-1')).toBeNull();
  });

  it('shows own leave on the now card list with the relief teacher', () => {
    asPhone();
    const lesson = snapshotFor(T.perera).cells.find((c) => c.day === 2 && c.period === 4)!;
    const leave: ReliefDay = {
      ...wedRelief,
      leaves: [{ teacherId: T.perera, type: 'full', entryIds: [lesson.entryId!] }],
      reliefs: [{ entryId: lesson.entryId!, absentTeacherId: T.perera, day: 2, period: 4, start: '09:50', end: '10:30', classIds: [C.c6a], subjectId: S.maths, reliefTeacherId: T.wijesekara }],
    };
    renderTeacher(<TodayPage />, { reliefDays: { [WED]: leave } });
    expect(screen.getByRole('region', { name: 'Rest of today' })).toHaveTextContent('On leave · relief: Ms. A. Wijesekara');
  });
});

describe('shell', () => {
  it('shows the four sections in the top bar on a desktop, My class only for a class teacher', () => {
    const { unmount } = renderTeacher(<TodayPage />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Today', `/s/${sid}/me`],
      ['Timetable', `/s/${sid}/me/timetable`],
      ['My class', `/s/${sid}/me/class`],
      ['Me', `/s/${sid}/me/profile`],
    ]);
    unmount();
    renderTeacher(<TodayPage />, { tid: T.gunasekara, teacher: { loading: false } });
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'My class' })).toBeNull();
  });

  it('shows a bottom tab bar on a phone', () => {
    asPhone();
    renderTeacher(<TodayPage />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveClass('fixed', 'bottom-0');
    expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  it('toggles language with a translated, descriptive label', async () => {
    const setLang = vi.fn();
    renderWithSchool(
      <LangContextProvider value={{ lang: 'en', setLang }}>
        <TeacherShell now={wed0920} snapshot={{ loading: false, data: snapshotFor(T.perera) }} reliefDays={{}} classes={[]}>
          <TodayPage />
        </TeacherShell>
      </LangContextProvider>,
      { ctx, claims: claims(T.perera) },
    );
    const btn = screen.getByRole('button', { name: 'Language: සිංහල' });
    expect(btn).toHaveTextContent('සිං');
    await userEvent.click(btn);
    expect(setLang).toHaveBeenCalledWith('si');
  });

  it('shows the uploaded logo and no badge in place of a missing one', () => {
    const { unmount } = renderTeacher(<TodayPage />);
    expect(screen.queryByTestId('school-logo')).toBeNull();
    unmount();
    renderTeacher(<TodayPage />, { ctx: { ...ctx, school: { ...ctx.school, logoUrl: 'https://example.test/logo.png' } } });
    expect(screen.getByTestId('school-logo')).toHaveAttribute('src', 'https://example.test/logo.png');
  });

  it('records the sign-in once the shell loads', () => {
    renderTeacher(<TodayPage />);
    expect(recordSignInOnce).toHaveBeenCalled();
  });

  it('keeps the on-brand colour token alpha-capable', () => {
    const colors = tailwindConfig.theme?.extend?.colors as unknown as Record<string, string>;
    expect(colors['on-brand']).toContain('<alpha-value>');
  });
});

describe('Timetable', () => {
  it('on a phone starts 3 days on today and steps by school day', async () => {
    asPhone();
    renderTeacher(<TimetablePage />, { now: fri0920 });
    expect(screen.getByRole('radio', { name: '3 days' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Fri 27 – Tue 1 December')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['', 'Fri · today', 'Mon 30', 'Tue 1']);
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.getByText('Mon 30 – Wed 2 December')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Earlier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Earlier' }));
    expect(screen.getByText('Thu 26 – Mon 30 November')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Print my timetable' })).toHaveAttribute('href', `/s/${sid}/me/print/timetable?auto=1`);
  });

  it('marks relief today and tomorrow in the 3-day grid', () => {
    asPhone();
    renderTeacher(<TimetablePage />, { reliefDays: { [WED]: wedRelief, [THU]: thuRelief } });
    expect(within(screen.getByTestId(`cell-${WED}-6`)).getByText('Relief')).toBeInTheDocument();
    expect(within(screen.getByTestId(`cell-${THU}-5`)).getByText('Relief')).toBeInTheDocument();
    expect(within(screen.getByTestId(`cell-${WED}-3`)).getByText('6B')).toBeInTheDocument();
  });

  it('shows the class only in the phone week and opens details on tap', async () => {
    asPhone();
    renderTeacher(<TimetablePage />, { reliefDays: { [WED]: wedRelief } });
    await userEvent.click(screen.getByRole('radio', { name: 'Week' }));
    expect(screen.queryByRole('button', { name: 'Earlier' })).toBeNull();
    const cell = screen.getByTestId(`cell-${WED}-6`);
    expect(within(cell).queryByText('Relief')).toBeNull();
    await userEvent.click(within(cell).getByRole('button', { name: '6B, Sinhala, Relief' }));
    const dialog = screen.getByRole('dialog', { name: '6B · Sinhala' });
    expect(dialog).toHaveTextContent('P6 · 11:30–12:10');
    expect(dialog).toHaveTextContent('for Mr. R. Silva');
  });

  it('lists every period in the Day view, free ones too', async () => {
    renderTeacher(<TimetablePage />, { reliefDays: { [WED]: wedRelief } });
    await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
    expect(screen.getByText('Wednesday 25 November', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByTestId('period-1')).toHaveTextContent('Free period');
    expect(screen.getByTestId('period-6')).toHaveTextContent('Covering for Mr. R. Silva');
  });

  it('renders both cells of a default row holding two class templates', () => {
    const extra = [...entries, entry('x-1a-0-5', 0, 5, [C.c1a], [[S.maths, T.wickramasinghe]]), entry('x-1a-0-6', 0, 6, [C.c1a], [[S.sinhala, T.wickramasinghe]])];
    const snap = snapshotFor(T.wickramasinghe, extra);
    expect(snap.cells.filter((c) => c.day === 0 && c.period === 5)).toHaveLength(2);
    renderTeacher(<TimetablePage />, { tid: T.wickramasinghe, snapshot: { loading: false, data: snap } });
    expect(within(screen.getByTestId('cell-2026-11-23-5')).getAllByText('1A')).toHaveLength(2);
  });

  it('shows joined class names and wraps Sinhala subject names', () => {
    const extra = [...entries, entry('x-comb', 0, 5, [C.c6a, C.c6b], [[S.maths, T.wickramasinghe]])];
    const { unmount } = renderTeacher(<TimetablePage />, { tid: T.wickramasinghe, snapshot: { loading: false, data: snapshotFor(T.wickramasinghe, extra) } });
    expect(within(screen.getByTestId('cell-2026-11-23-5')).getByText('6A+6B')).toBeInTheDocument();
    unmount();
    renderTeacher(<TimetablePage />, { lang: 'si' });
    const si = ctx.subjects.find((s) => s.id === S.maths)?.nameSi as string;
    const name = within(screen.getByTestId(`cell-${WED}-3`)).getByText(si);
    expect(name).not.toHaveClass('truncate');
    expect(name).toHaveClass('break-words');
  });

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
    renderTeacher(<TimetablePage />, { snapshot: { loading: false, data: snap } });
    expect(within(screen.getByTestId(`cell-${THU}-4`)).getByText('7A')).toBeInTheDocument();
  });

  it('names activity rows shared by every weekday, including before period 1', async () => {
    const act = (start: string, end: string, nameEn: string) => ({ type: 'activity' as const, start, end, nameEn });
    const p = (start: string, end: string) => ({ type: 'period' as const, start, end });
    const rows = [act('07:30', '07:45', 'Assembly'), p('07:45', '08:30'), act('08:30', '08:45', 'School meal'), p('08:45', '09:30')];
    const snap: TeacherSnapshot = { ...snapshotFor(T.perera), rows: { 0: rows, 1: rows, 2: rows, 3: rows, 4: rows }, cells: [] };
    const { unmount } = renderTeacher(<TimetablePage />, { snapshot: { loading: false, data: snap } });
    expect(screen.getByText(/Assembly/)).toBeInTheDocument();
    expect(screen.getByText(/School meal/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
    expect(screen.getByText(/Assembly · 7:30/)).toBeInTheDocument();
    unmount();
    const only = { 0: rows, 1: rows.slice(1), 2: rows.slice(1), 3: rows.slice(1), 4: rows.slice(1) };
    renderTeacher(<TimetablePage />, { snapshot: { loading: false, data: { ...snap, rows: only } } });
    expect(screen.queryByText(/Assembly/)).toBeNull();
  });
});

describe('My class', () => {
  it('lists the class day with each subject teacher, and today’s relief', () => {
    asPhone();
    renderTeacher(<MyClassPage />, { reliefDays: { [WED]: wedRelief } });
    expect(screen.getByRole('heading', { name: '6B' })).toBeInTheDocument();
    expect(screen.getByText('You are the class teacher')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Wednesday' })).toHaveAttribute('aria-checked', 'true');
    const rows = within(screen.getByRole('list', { name: 'Periods' })).getAllByRole('listitem');
    const row = (n: string) => rows.find((r) => r.textContent?.startsWith(n))!;
    expect(row('P1')).toHaveTextContent('EnglishMs. A. Wijesekara');
    expect(row('P3')).toHaveTextContent('MathsYou');
    expect(row('P6')).toHaveTextContent('Mr. R. Silva · away');
    expect(within(row('P6')).getByText('Mr. R. Silva').tagName).toBe('S');
    expect(row('P6')).toHaveTextContent('Relief: Mrs. N. Perera');
    expect(row('P8')).toHaveTextContent('No relief yet');
    expect(screen.queryByText(/07\d/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Print 6B timetable' })).toHaveAttribute('href', `/s/${sid}/me/print/class/${C.c6b}?auto=1`);
  });

  it('shows relief only on today’s day', async () => {
    asPhone();
    renderTeacher(<MyClassPage />, { reliefDays: { [WED]: wedRelief } });
    await userEvent.click(screen.getByRole('radio', { name: 'Tuesday' }));
    expect(screen.queryByText(/away/)).toBeNull();
  });

  it('shows the week with relief notes on a desktop', () => {
    renderTeacher(<MyClassPage />, { reliefDays: { [WED]: wedRelief } });
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId(`cell-${WED}-6`)).toHaveTextContent('Relief: Mrs. N. Perera');
    expect(screen.getByTestId(`cell-${WED}-8`)).toHaveTextContent('No relief yet');
    expect(screen.getByTestId('cell-2026-11-23-2')).toHaveTextContent('ScienceMrs. S. Gunasekara');
  });

  it('shows every absent teacher of a grouped lesson in the week', () => {
    const group = class6B.cells.find((c) => c.day === 2 && c.period === 2 && c.isGroup)!;
    const base = { entryId: group.entryId!, day: 2 as const, period: 2, start: '08:30', end: '09:10', classIds: [C.c6a, C.c6b], subjectId: S.buddhism };
    const two: ReliefDay = {
      ...wedRelief,
      names: { ...names, [T.ananda]: { en: 'Ven. Ananda Thero' }, [T.rizan]: { en: 'Mr. M. Rizan' } },
      reliefs: [
        { ...base, absentTeacherId: T.ananda, reliefTeacherId: T.perera },
        { ...base, absentTeacherId: T.rizan, subjectId: S.islam, reliefTeacherId: null },
      ],
    };
    renderTeacher(<MyClassPage />, { reliefDays: { [WED]: two } });
    const cell = screen.getByTestId(`cell-${WED}-2`);
    expect(cell).toHaveTextContent('Relief: Mrs. N. Perera · No relief yet');
  });

  it('says so for a teacher who is not a class teacher', () => {
    renderTeacher(<MyClassPage />, { classes: [] });
    expect(screen.getByText('You are not a class teacher')).toBeInTheDocument();
  });

  it('shows the not-published state for a class without a snapshot', () => {
    renderTeacher(<MyClassPage />, { classSnapshots: {} });
    expect(screen.getByText('Not published yet')).toBeInTheDocument();
  });

  it('lets a teacher of two classes pick one', async () => {
    const other: SchoolClass = { ...ctx.classes.find((c) => c.id === C.c6a)! };
    const snap6A: ClassSnapshot = built.classes.find((c) => c.classId === C.c6a)!;
    renderTeacher(<MyClassPage />, { classes: [cls6B, other], classSnapshots: { [C.c6b]: class6B, [C.c6a]: snap6A } });
    expect(screen.getByRole('heading', { name: '6A' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '6B' }));
    expect(screen.getByRole('heading', { name: '6B' })).toBeInTheDocument();
  });
});

describe('Me', () => {
  beforeEach(() => {
    vi.mocked(call).mockReset();
    vi.mocked(call).mockImplementation(((name: string) => (name === 'myReliefCount' ? Promise.resolve({ count: 7 }) : new Promise(() => undefined))) as never);
  });

  it('on a desktop shows the profile card, this year as tiles, details and periods each day', async () => {
    renderTeacher(<MePage />, { role: 'a', reliefDays: { [WED]: wedRelief } });
    const profile = screen.getByRole('region', { name: 'Profile' });
    expect(within(profile).getByRole('heading', { name: 'Mrs. N. Perera' })).toBeInTheDocument();
    expect(profile).toHaveTextContent('Mathematics · Grades 6, 7, 8, 10');
    expect(profile).toHaveTextContent('Class teacher · 6B');
    expect(profile).toHaveTextContent('SCC024');
    expect(within(profile).getByRole('link', { name: 'Print my timetable' })).toHaveAttribute('href', `/s/${sid}/me/print/timetable?auto=1`);
    expect(within(profile).getByRole('link', { name: 'Print 6B timetable' })).toHaveAttribute('href', `/s/${sid}/me/print/class/${C.c6b}?auto=1`);
    expect(within(profile).getByRole('link', { name: 'School admin' })).toHaveAttribute('href', `/s/${sid}/admin`);
    expect(within(profile).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

    const year = screen.getByRole('region', { name: 'This year' });
    expect(year).toHaveTextContent('Periods a week733 free of 40');
    // Periods a week and the relief count from myReliefCount are both 7 here.
    await waitFor(() => expect(within(year).getAllByText('7', { selector: 'b' })).toHaveLength(2));
    expect(year).toHaveTextContent('Classes I teach26A, 6B');
    expect(call).toHaveBeenCalledWith('myReliefCount', { schoolId: sid });

    const details = screen.getByRole('region', { name: 'My details' });
    expect(details).toHaveTextContent('NameMrs. N. Perera');
    expect(details).toHaveTextContent('Staff IDSCC024');
    expect(details).toHaveTextContent('Emailn.perera@siripura.example.com');
    expect(details).toHaveTextContent('To change these, ask your school admin.');
    expect(within(details).getByLabelText('Phone number')).toHaveValue('071 234 5678');
    expect(details).toHaveTextContent('You can change this one.');

    const days = screen.getByRole('region', { name: 'Periods each day' });
    expect(within(days).getByRole('listitem', { name: 'Monday: 1 lesson' })).toBeInTheDocument();
    expect(within(days).getByRole('listitem', { name: 'Wednesday: 2 lessons and 1 relief period today' })).toHaveTextContent('2 + 1');
  });

  it('on a phone puts the This year tiles under the name, then details with the phone field', async () => {
    asPhone();
    // Two more classes on Monday, so Classes I teach shows four and folds the last into "+1".
    const base = snapshotFor(T.perera);
    const extra = (period: number, title: string) => ({ day: 0 as const, period, start: '09:10', end: '09:50', title, sub: 'Mathematics', color: '', isGroup: false });
    renderTeacher(<MePage />, { role: 'a', snapshot: { loading: false, data: { ...base, cells: [...base.cells, extra(3, '7A'), extra(4, '8C')] } } });
    expect(screen.getByRole('heading', { name: 'Mrs. N. Perera' })).toBeInTheDocument();
    expect(screen.getByText(/Mathematics · Gr 6, 7, 8, 10/)).toHaveTextContent('Mathematics · Gr 6, 7, 8, 10 · CT 6B');
    expect(screen.getByText('CT 6B')).toHaveAttribute('title', 'Class teacher · 6B');

    const year = screen.getByRole('region', { name: 'This year' });
    expect(year).toHaveTextContent('Periods a week931 free of 40');
    expect(await within(year).findByText('Relief covered')).toBeInTheDocument();
    await waitFor(() => expect(year).toHaveTextContent('Relief covered7This year'));
    expect(year).toHaveTextContent('Classes I teach46A 6B 7A +1');

    const details = screen.getByRole('region', { name: 'My details' });
    expect(details).not.toHaveTextContent('Name');
    expect(details).toHaveTextContent('Staff IDSCC024');
    expect(details).toHaveTextContent('Emailn.perera@siripura.example.com');
    expect(within(details).getByLabelText('Phone number')).toHaveValue('071 234 5678');
    expect(screen.getByText('To change your name, staff ID or email, ask your school admin.')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Print timetable' })).toHaveAttribute('href', `/s/${sid}/me/print/timetable?auto=1`);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'School admin' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Profile' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Periods each day' })).toBeNull();
  });

  it('highlights the School admin link on a phone and on a desktop', () => {
    asPhone();
    const { unmount } = renderTeacher(<MePage />, { role: 'a' });
    expect(screen.getByRole('link', { name: 'School admin' })).toHaveClass('text-brand!', 'bg-brand/5!');
    unmount();
    restoreMedia?.();
    restoreMedia = installMatchMedia(1280);
    renderTeacher(<MePage />, { role: 'a' });
    expect(screen.getByRole('link', { name: 'School admin' })).toHaveClass('text-brand!', 'bg-brand/5!');
  });

  it('says Not published yet instead of a dash before the timetable is published', () => {
    const { unmount } = renderTeacher(<MePage />, { snapshot: { loading: false } });
    const year = screen.getByRole('region', { name: 'This year' });
    expect(within(year).getAllByText('Not published yet')).toHaveLength(2);
    expect(screen.queryByRole('region', { name: 'Periods each day' })).toBeNull();
    unmount();
    asPhone();
    renderTeacher(<MePage />, { snapshot: { loading: false } });
    expect(screen.getByRole('region', { name: 'This year' })).toHaveTextContent('Periods a weekNot published yet');
  });

  it('hides the admin link for a plain teacher and has no change-password button', () => {
    renderTeacher(<MePage />);
    expect(screen.queryByRole('link', { name: 'School admin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change password' })).toBeNull();
  });

  it('saves the phone at once through setMyPhone', async () => {
    vi.mocked(call).mockImplementation(((name: string) => (name === 'setMyPhone' ? Promise.resolve({ phone: '077 111 2222' }) : new Promise(() => undefined))) as never);
    renderTeacher(<MePage />);
    const input = screen.getByLabelText('Phone number');
    expect(input).toHaveValue('071 234 5678');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, ' 077  111 2222');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(call).toHaveBeenCalledWith('setMyPhone', { schoolId: sid, phone: '077 111 2222' });
    expect(await screen.findByText('Phone number saved')).toBeInTheDocument();
  });

  it('refuses a value that is not a phone number without calling', async () => {
    renderTeacher(<MePage />);
    const input = screen.getByLabelText('Phone number');
    await userEvent.clear(input);
    await userEvent.type(input, 'call me');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a phone number, for example 071 234 5678.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(call).not.toHaveBeenCalledWith('setMyPhone', expect.anything());
  });

  it('shows the error for an invalid value when no phone is saved yet', async () => {
    const { phone: _p, ...noPhone } = pereraRecord;
    renderTeacher(<MePage />, { teacher: { loading: false, data: noPhone } });
    const input = screen.getByLabelText('Phone number');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.type(input, 'abc');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a phone number, for example 071 234 5678.')).toBeInTheDocument();
    expect(call).not.toHaveBeenCalledWith('setMyPhone', expect.anything());
  });

  it('clears the phone with an empty value', async () => {
    vi.mocked(call).mockImplementation(((name: string) => (name === 'setMyPhone' ? Promise.resolve({ phone: null }) : new Promise(() => undefined))) as never);
    renderTeacher(<MePage />);
    await userEvent.clear(screen.getByLabelText('Phone number'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(call).toHaveBeenCalledWith('setMyPhone', { schoolId: sid, phone: '' });
    expect(await screen.findByText('Phone number removed')).toBeInTheDocument();
  });

  it('shows a dash when the relief count cannot load', () => {
    vi.mocked(call).mockImplementation((() => Promise.reject(new Error('offline'))) as never);
    const { unmount } = renderTeacher(<MePage />);
    expect(screen.getByRole('region', { name: 'This year' })).toHaveTextContent('Relief periods covered—');
    unmount();
    asPhone();
    renderTeacher(<MePage />);
    expect(screen.getByRole('region', { name: 'This year' })).toHaveTextContent('Relief covered—');
  });

  it('counts two lessons in one period once, so periods a week and free add up to the week', () => {
    const base = snapshotFor(T.perera);
    const mon1 = base.cells.find((c) => c.day === 0 && c.period === 1)!;
    const m = meStats({ ...base, cells: [...base.cells, { ...mon1, title: '1A', entryId: 'x-1a' }] }, null, null);
    expect(m.periodsAWeek).toBe(7);
    expect(m.periodsAWeek + m.free).toBe(m.periodSlots);
    expect(m.days[0]!.lessons).toBe(1);
    expect(m.classes).toEqual(['1A', '6A', '6B']);
  });

  it('fills the phone field when the teacher record loads after the first render, and keeps an edit when it changes', async () => {
    let setTeacher: (t: TeacherShellProps['teacher']) => void = () => undefined;
    function Live() {
      const [teacher, set] = useState<TeacherShellProps['teacher']>({ loading: true });
      setTeacher = set;
      return (
        <TeacherShell now={wed0920} snapshot={{ loading: false, data: snapshotFor(T.perera) }} reliefDays={{}} classes={[cls6B]} classSnapshots={{}} teacher={teacher}>
          <MePage />
        </TeacherShell>
      );
    }
    renderWithSchool(<Live />, { ctx, route: `/s/${sid}/me`, claims: claims(T.perera) });
    act(() => setTeacher({ loading: false, data: pereraRecord }));
    expect(screen.getByLabelText('Phone number')).toHaveValue('071 234 5678');

    await userEvent.clear(screen.getByLabelText('Phone number'));
    await userEvent.type(screen.getByLabelText('Phone number'), '077');
    act(() => setTeacher({ loading: false, data: { ...pereraRecord, phone: '011 222 3333' } }));
    expect(screen.getByLabelText('Phone number')).toHaveValue('077');
  });

  it('keeps a half-typed phone number when the screen crosses 768 px', async () => {
    renderTeacher(<MePage />);
    const typed = screen.getByLabelText('Phone number');
    await userEvent.clear(typed);
    await userEvent.type(typed, '077 999');
    resizeTo(390);
    expect(screen.queryByRole('region', { name: 'Profile' })).toBeNull();
    expect(screen.getByLabelText('Phone number')).toHaveValue('077 999');
    resizeTo(1280);
    expect(screen.getByRole('region', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByLabelText('Phone number')).toHaveValue('077 999');
  });

  it('counts lessons, free periods, classes and today’s relief from the published timetable', () => {
    const snap = snapshotFor(T.perera);
    const today = overlayRelief(snap, wedRelief, T.perera, 'en');
    const m = meStats(snap, today, 2);
    expect([m.periodsAWeek, m.periodSlots, m.free]).toEqual([7, 40, 33]);
    expect(m.classes).toEqual(['6A', '6B']);
    expect(m.days.map((d) => [d.lessons, d.relief])).toEqual([[1, 0], [1, 0], [2, 1], [2, 0], [1, 0]]);
    expect(m.days[2]!.slots[5]).toBe('relief');
    expect(meStats(snap, today, null).days[2]!.relief).toBe(0);
  });
});
