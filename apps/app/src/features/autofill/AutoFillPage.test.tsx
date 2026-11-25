// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { C, ctx, entries6B, S } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { ClassViewPage } from '../timetable/ClassViewPage';
import { TeacherViewPage } from '../timetable/TeacherViewPage';
import { AutoFillPage } from './AutoFillPage';

const mocked = vi.hoisted(() => ({ result: null as null | { blocking: unknown[]; warnings: unknown[] } }));
vi.mock('@sathiya/core', async (orig) => {
  const actual = await orig<typeof import('@sathiya/core')>();
  return { ...actual, readiness: (...a: Parameters<typeof actual.readiness>) => mocked.result ?? actual.readiness(...a) };
});

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

beforeEach(() => {
  mocked.result = null;
  ro.value = false;
  sessionStorage.clear();
});

function setup(context = ctx, route = '/s/siripura/admin/timetable/auto-fill') {
  renderWithSchool(
    <Routes>
      <Route path="/s/siripura/admin/timetable/auto-fill" element={<AutoFillPage />} />
      <Route path="/s/siripura/admin/timetable/class/:classId" element={<ClassViewPage />} />
      <Route path="/s/siripura/admin/timetable/teacher/:teacherId" element={<TeacherViewPage />} />
    </Routes>,
    { ctx: context, entries: entries6B, route },
  );
}

describe('AutoFillPage', () => {
  it('shows blocking issues with links and disables Continue', () => {
    setup({ ...ctx, classes: ctx.classes.map((c) => (c.id === C.c6b ? { ...c, classTeacherId: undefined } : c)) });
    const group = screen.getByRole('heading', { name: 'Grades & classes' }).closest('section')!;
    const item = within(group).getAllByRole('listitem').find((li) => /6B/.test(li.textContent ?? ''))!;
    expect(item).toHaveTextContent(/has no class teacher/);
    expect(within(item).getByRole('link')).toHaveAttribute('href', '/s/siripura/admin/grades');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.queryByText('Ready to generate')).not.toBeInTheDocument();
  });

  it('groups the same missing teacher across classes into one line', () => {
    const issue = (classId: string) => ({ code: 'no-qualified-teacher', ref: { kind: 'class', id: classId }, params: { classId, subjectId: S.geography, grade: 6 } });
    mocked.result = { blocking: [issue(C.c6a), issue(C.c6b), issue(C.c6c)], warnings: [] };
    setup();
    const items = within(screen.getByRole('heading', { name: 'Teachers' }).closest('section')!).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('No teacher with Grade 6 in their grades teaches Geography (6A, 6B, 6C).');
    expect(within(items[0]!).getByRole('link')).toHaveAttribute('href', '/s/siripura/admin/teachers');
  });

  it('groups the unbuildable days of one class item into one line', () => {
    const issue = (day: number) => ({ code: 'per-day-unbuildable', ref: { kind: 'class', id: C.c6a }, params: { classId: C.c6a, planKey: `subject:${S.maths}`, day, minutes: 10 } });
    mocked.result = { blocking: [issue(0), issue(1)], warnings: [] };
    setup();
    const items = within(screen.getByRole('heading', { name: 'Templates' }).closest('section')!).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/Monday, Tuesday/);
  });

  it('shows the ready state with warnings and no Continue button', () => {
    mocked.result = { blocking: [], warnings: [{ code: 'capacity-short', ref: { kind: 'subject', id: S.maths }, params: { subjectId: S.maths, needed: 30, capacity: 20 } }] };
    setup();
    expect(screen.getByRole('heading', { name: 'Ready to generate' })).toBeInTheDocument();
    expect(screen.getByText(/Mathematics/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByText(/next update/)).toBeInTheDocument();
  });

  it('shows the ready state with nothing to fix', () => {
    mocked.result = { blocking: [], warnings: [] };
    setup();
    expect(screen.getByRole('heading', { name: 'Ready to generate' })).toBeInTheDocument();
  });
});

describe('Auto-fill button', () => {
  it('opens the readiness screen from the class view', async () => {
    mocked.result = { blocking: [], warnings: [] };
    setup(ctx, `/s/siripura/admin/timetable/class/${C.c6b}`);
    await userEvent.click(screen.getByRole('link', { name: 'Auto-fill' }));
    expect(await screen.findByRole('heading', { name: 'Ready to generate' })).toBeInTheDocument();
  });

  it('is on the teacher view and hidden for read-only years', () => {
    setup(ctx, '/s/siripura/admin/timetable/teacher/' + ctx.teachers[0]!.id);
    expect(screen.getByRole('link', { name: 'Auto-fill' })).toBeInTheDocument();
  });

  it('is hidden when read-only', () => {
    ro.value = true;
    setup(ctx, `/s/siripura/admin/timetable/class/${C.c6b}`);
    expect(screen.queryByRole('link', { name: 'Auto-fill' })).not.toBeInTheDocument();
  });
});
