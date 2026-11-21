// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Entry, SchoolContext } from '@sathiya/core';
import { C, ctx, entries, entry, S, T } from '@sathiya/core/fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { TeacherIndexRedirect, TeacherViewPage } from './TeacherViewPage';
import { TimetableApiContext, type TimetableApi } from './useTimetable';

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

function makeApi(): TimetableApi {
  return {
    saveEntry: vi.fn().mockResolvedValue({ entryId: 'new' }),
    deleteEntry: vi.fn().mockResolvedValue({ ok: true }),
  };
}

function setup(teacherId: string = T.ananda, opts: { entries?: Entry[]; ctx?: SchoolContext; route?: string } = {}) {
  const api = makeApi();
  renderWithSchool(
    <TimetableApiContext.Provider value={api}>
      <Routes>
        <Route path="/admin/timetable/teacher" element={<TeacherIndexRedirect />} />
        <Route path="/admin/timetable/teacher/:teacherId" element={<TeacherViewPage />} />
      </Routes>
    </TimetableApiContext.Provider>,
    { ctx: opts.ctx ?? ctx, entries: opts.entries ?? entries, route: opts.route ?? `/admin/timetable/teacher/${teacherId}` },
  );
  return api;
}

const slot = (day: string, n: number) => screen.getByRole('button', { name: new RegExp(`^${day}, period ${n},`) });
const teacherButton = () => screen.getByRole('button', { name: 'Teacher' });

async function activate(day: string, n: number) {
  await userEvent.click(slot(day, n));
  await userEvent.click(slot(day, n));
}

async function chooseSubject(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Subject' }));
  await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));
}

beforeEach(() => {
  ro.value = false;
});

describe('TeacherViewPage', () => {
  it('shows the teacher header and their lessons on default-template rows', () => {
    setup();
    expect(teacherButton()).toHaveTextContent('Ven. Ananda Thero · SCC042');
    expect(screen.getByText(/max 6 \/ day/)).toHaveTextContent('Buddhism, Pali · Grades 6 – 13 · max 6 / day · 3 periods this week');
    expect(slot('Monday', 4)).toHaveTextContent('⧉ 6A+6B');
    expect(slot('Monday', 4)).toHaveTextContent('Buddhism');
    expect(slot('Monday', 1)).toHaveTextContent('+');
  });

  it('moves between teachers with prev/next and search by staff ID', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Next teacher' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Previous teacher' }));
    expect(teacherButton()).toHaveTextContent('Rev. Fr. M. Silva');
    await userEvent.click(teacherButton());
    await userEvent.type(screen.getByPlaceholderText('Search name or staff ID…'), 'SCC019');
    await userEvent.click(screen.getByRole('option', { name: /Gunasekara/ }));
    expect(teacherButton()).toHaveTextContent('Mrs. S. Gunasekara · SCC019');
  });

  it('shows a per-day load bar, red when over the daily limit', () => {
    const extra = [1, 2, 3, 5, 6, 7].map((p) => entry(`x${p}`, 0, p, [C.c12a], [[S.buddhism, T.ananda]]));
    setup(T.ananda, { entries: [...entries, ...extra] });
    const mon = screen.getByRole('meter', { name: 'Monday load' });
    expect(mon).toHaveAttribute('aria-valuetext', '7/6');
    expect(mon).toHaveAttribute('data-over', 'true');
    expect(mon).toHaveTextContent('7/6');
    const wed = screen.getByRole('meter', { name: 'Wednesday load' });
    expect(wed).toHaveAttribute('aria-valuetext', '1/6');
    expect(wed).toHaveAttribute('data-over', 'false');
  });

  it('stacks two Primary lessons that fall in one default row', () => {
    const two = [entry('p5', 0, 5, [C.c1a], [[S.sinhala, T.wickramasinghe]]), entry('p6', 0, 6, [C.c1a], [[S.maths, T.wickramasinghe]])];
    setup(T.wickramasinghe, { entries: two });
    const cell = slot('Monday', 5);
    expect(within(cell).getAllByText('1A')).toHaveLength(2);
    expect(cell).toHaveTextContent('Sinhala · 10:40–11:05');
    expect(cell).toHaveTextContent('Mathematics · 11:05–11:30');
  });

  it('assigns a Primary class at its matched class period', async () => {
    const api = setup(T.wickramasinghe, { entries: [] });
    await activate('Monday', 5);
    await chooseSubject('Sinhala');
    await userEvent.click(screen.getByRole('button', { name: /^1A/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveEntry).toHaveBeenCalledWith({
      schoolId: ctx.school.id,
      yearId: 'y-2026',
      entry: { day: 0, period: 6, classIds: [C.c1a], lessons: [{ subjectId: S.sinhala, teacherId: T.wickramasinghe }] },
    });
    expect(slot('Monday', 5)).toHaveTextContent('1A');
  });

  it('does not offer the Primary class when the default row has no overlap', async () => {
    setup(T.wickramasinghe, { entries: [] });
    await activate('Monday', 8);
    await chooseSubject('Sinhala');
    expect(screen.queryByRole('button', { name: /^1A/ })).not.toBeInTheDocument();
  });

  it('opens the block editor with the teacher preset for a group option', async () => {
    setup(T.ananda, { entries: [] });
    await activate('Wednesday', 5);
    await chooseSubject('Buddhism');
    await userEvent.click(screen.getByRole('button', { name: /^6A/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Religion' });
    expect(within(dialog).getByLabelText(/Buddhism/)).toHaveValue(T.ananda);
  });

  it('opens the block editor for a block cell, and on Delete instead of deleting', async () => {
    const api = setup();
    await activate('Monday', 4);
    expect(screen.getByRole('dialog', { name: 'Religion' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.keyDown(slot('Monday', 4), { key: 'Delete' });
    expect(screen.getByRole('button', { name: 'Remove block' })).toBeInTheDocument();
    expect(api.deleteEntry).not.toHaveBeenCalled();
  });

  it('edits or clears a single-class lesson', async () => {
    const api = setup(T.perera);
    await activate('Monday', 1);
    expect(screen.getByRole('dialog', { name: 'Choose a class' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear slot' }));
    await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e-6b-0-1' })));
  });

  it('removes a single-class lesson with the Delete key', async () => {
    const api = setup(T.perera);
    await userEvent.click(slot('Monday', 1));
    fireEvent.keyDown(slot('Monday', 1), { key: 'Delete' });
    await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e-6b-0-1' })));
  });

  it('asks which lesson to edit when a row holds two', async () => {
    const two = [entry('p5', 0, 5, [C.c1a], [[S.sinhala, T.wickramasinghe]]), entry('p6', 0, 6, [C.c1a], [[S.maths, T.wickramasinghe]])];
    setup(T.wickramasinghe, { entries: two });
    await activate('Monday', 5);
    const chooser = screen.getByRole('dialog', { name: 'Choose a lesson' });
    await userEvent.click(within(chooser).getByRole('button', { name: /Mathematics/ }));
    expect(screen.getByRole('dialog', { name: 'Choose a class' })).toHaveTextContent('Now: 1A · Mathematics');
  });

  it('lists lessons outside school hours under the grid', () => {
    const late = { id: 'tpl-late', name: 'Late', isDefault: false, mode: 'same' as const, rows: [{ type: 'period' as const, start: '14:00', end: '14:40' }] };
    const c2: SchoolContext = {
      ...ctx,
      templates: [...ctx.templates, late],
      classes: ctx.classes.map((c) => (c.id === C.c1a ? { ...c, templateId: late.id } : c)),
    };
    setup(T.wickramasinghe, { ctx: c2, entries: [entry('late', 2, 1, [C.c1a], [[S.sinhala, T.wickramasinghe]])] });
    expect(screen.getByText('Outside school hours')).toBeInTheDocument();
    expect(screen.getByText('Wednesday · 1A Sinhala · 14:00–14:40')).toBeInTheDocument();
  });

  it('read-only: load bars but no picker or delete', async () => {
    ro.value = true;
    const api = setup(T.perera);
    expect(screen.getByRole('meter', { name: 'Monday load' })).toBeInTheDocument();
    await activate('Wednesday', 5);
    await activate('Monday', 1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(slot('Monday', 1), { key: 'Delete' });
    expect(api.deleteEntry).not.toHaveBeenCalled();
  });

  it('redirects the index route to the first teacher by name', () => {
    setup(T.ananda, { route: '/admin/timetable/teacher' });
    expect(teacherButton()).toHaveTextContent('Mr. A. Rizan');
  });

  it('shows an empty state when there are no teachers', () => {
    setup(T.ananda, { ctx: { ...ctx, teachers: [] }, route: '/admin/timetable/teacher' });
    expect(screen.getByText('No teachers yet')).toBeInTheDocument();
  });
});
