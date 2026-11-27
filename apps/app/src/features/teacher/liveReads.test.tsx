// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { buildSnapshots, paths, type Year } from '@sathiya/core';
import { C, T, ctx as baseCtx, entries } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCollection, useDoc } from '../../lib/firestore';
import { installMatchMedia } from '../../test/matchMedia';
import { renderWithSchool } from '../../test/renderWithSchool';
import { MyClassPage } from './MyClassPage';
import { PrintMyClassPage } from './PrintMine';
import { TeacherShell } from './TeacherShell';
import { TimetablePage } from './TimetablePage';
import { TodayPage } from './TodayPage';

vi.mock('./signIn');
vi.mock('../../lib/firestore', () => ({ useDoc: vi.fn(), useCollection: vi.fn() }));

// These tests drive the live reads (nothing injected), with each Firestore path answered by the mocks below.
const year: Year = { id: 'y-2026', label: '2026', status: 'published' };
const ctx = { ...baseCtx, school: { ...baseCtx.school, activeYearId: year.id } };
const sid = ctx.school.id;
const claims = { schools: { [sid]: { r: 't' as const, t: T.perera } } };
const built = buildSnapshots(ctx, entries, year);
const wed0920 = () => new Date('2026-11-25T03:50:00Z');
const todayPath = paths.reliefDay(sid, year.id, '2026-11-25');
const nextPath = paths.reliefDay(sid, year.id, '2026-11-26');

type State = { loading: boolean; data?: unknown; error?: Error };
let docs: Record<string, State>;
let classes: { loading: boolean; data: unknown[]; error?: Error };

beforeEach(() => {
  docs = {
    [paths.publishedTeacher(sid, year.id, T.perera)]: { loading: false, data: built.teachers.find((t) => t.teacherId === T.perera) },
    [paths.publishedClass(sid, year.id, C.c6b)]: { loading: false, data: built.classes.find((c) => c.classId === C.c6b) },
    [todayPath]: { loading: false },
    [nextPath]: { loading: false },
  };
  classes = { loading: false, data: [ctx.classes.find((c) => c.id === C.c6b)!] };
  vi.mocked(useDoc).mockImplementation(((path: string | null) => (path ? (docs[path] ?? { loading: false }) : { loading: false })) as never);
  vi.mocked(useCollection).mockImplementation(((path: string | null) => (path ? classes : { loading: false, data: [] })) as never);
});

let restoreMedia: (() => void) | undefined;
beforeEach(() => {
  restoreMedia = installMatchMedia(1280);
});
afterEach(() => restoreMedia?.());

const render = (page: ReactElement) =>
  renderWithSchool(<TeacherShell now={wed0920}>{page}</TeacherShell>, { ctx, claims, route: `/s/${sid}/me` });

describe('relief-day reads', () => {
  it('treat a missing relief doc that loaded fine as no relief', () => {
    render(<TodayPage />);
    expect(screen.getByTestId('now-card')).toHaveTextContent('Mathematics · 6B');
  });

  it.each([
    ['today', todayPath],
    ['the next school day', nextPath],
  ])('show loading, not a schedule without relief, while %s is loading', (_, path) => {
    docs[path] = { loading: true };
    const { unmount } = render(<TodayPage />);
    expect(screen.queryByTestId('now-card')).toBeNull();
    unmount();
    render(<TimetablePage />);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it.each([
    ['today', todayPath],
    ['the next school day', nextPath],
  ])('show an error with Try again when %s fails to load', (_, path) => {
    docs[path] = { loading: false, error: new Error('denied') };
    const { unmount } = render(<TodayPage />);
    expect(screen.queryByTestId('now-card')).toBeNull();
    expect(screen.getByText('Could not load your timetable. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    unmount();
    render(<TimetablePage />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('keep My class from showing relief-less lessons when today’s relief fails', () => {
    docs[todayPath] = { loading: false, error: new Error('denied') };
    render(<MyClassPage />);
    expect(screen.getByText('Could not load your class. Please try again.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('class query errors', () => {
  it('keep the My class tab and show an error with Try again, not "not a class teacher"', () => {
    classes = { loading: false, data: [], error: new Error('denied') };
    render(<MyClassPage />);
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'My class' })).toBeInTheDocument();
    expect(screen.getByText('Could not load your class. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('You are not a class teacher')).toBeNull();
  });

  it('hide the tab only for a query that worked and found no class', () => {
    classes = { loading: false, data: [] };
    render(<MyClassPage />);
    expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'My class' })).toBeNull();
    expect(screen.getByText('You are not a class teacher')).toBeInTheDocument();
  });

  it('show the print error state, not "Class not found", when the query fails', () => {
    classes = { loading: false, data: [], error: new Error('denied') };
    renderWithSchool(<PrintMyClassPage />, { ctx, claims, route: `/s/${sid}/me/print/class/${C.c6b}`, path: '/s/:sid/me/print/class/:id' });
    expect(screen.queryByText('Class not found')).toBeNull();
    expect(screen.getByRole('heading', { name: /Could not load/ })).toBeInTheDocument();
  });
});
