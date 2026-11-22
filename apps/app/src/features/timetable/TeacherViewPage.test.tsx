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
        <Route path="/s/:sid/timetable/teacher/:teacherId" element={<TeacherViewPage />} />
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

const pinBar = () => screen.getByRole('region', { name: 'Pin mode' });
const grid = () => screen.getByRole('group', { name: 'Timetable grid' });
const cellNamed = (name: RegExp) => within(grid()).getByRole('button', { name });

async function chooseSubjectInPopup(name: string) {
  await userEvent.click(within(screen.getByRole('listbox', { name: 'Subjects' })).getByRole('option', { name: new RegExp(`^${name}`) }));
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

  it('uses the singular for one period this week', () => {
    setup(T.perera, { entries: [entry('one', 0, 1, [C.c6b], [[S.maths, T.perera]])] });
    expect(screen.getByText(/this week/)).toHaveTextContent(/· 1 period this week$/);
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
    expect(mon).toHaveAttribute('aria-valuenow', '7');
    expect(mon).toHaveAttribute('aria-valuemax', '7');
    expect(mon).toHaveAttribute('data-over', 'true');
    expect(mon).toHaveTextContent('7/6');
    const wed = screen.getByRole('meter', { name: 'Wednesday load' });
    expect(wed).toHaveAttribute('aria-valuetext', '1/6');
    expect(wed).toHaveAttribute('data-over', 'false');
    expect(wed).toHaveAttribute('aria-valuemax', '6');
  });

  it('stacks two Primary lessons that fall in one default row', () => {
    const two = [entry('p5', 0, 5, [C.c1a], [[S.sinhala, T.wickramasinghe]]), entry('p6', 0, 6, [C.c1a], [[S.maths, T.wickramasinghe]])];
    setup(T.wickramasinghe, { entries: two });
    const cell = slot('Monday', 5);
    expect(within(cell).getAllByText('1A')).toHaveLength(2);
    expect(cell).toHaveTextContent('Sinhala · 10:40–11:05');
    expect(cell).toHaveTextContent('Mathematics · 11:05–11:30');
  });

  it('opens the assign popup from an empty cell', async () => {
    setup(T.rizan);
    await activate('Wednesday', 4);
    const popup = screen.getByRole('dialog', { name: 'Choose a subject' });
    expect(within(popup).getByRole('combobox', { name: 'Search subjects' })).toBeInTheDocument();
    expect(within(popup).getByRole('listbox', { name: 'Subjects' })).toHaveTextContent('English');
  });

  it('assigns a Primary class at its matched class period and starts pin mode', async () => {
    const api = setup(T.wickramasinghe, { entries: [] });
    await activate('Monday', 5);
    await chooseSubjectInPopup('Mathematics');
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Classes' })).getByRole('option', { name: /^1A/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveEntry).toHaveBeenCalledWith({
      schoolId: ctx.school.id,
      yearId: 'y-2026',
      entry: { day: 0, period: 5, classIds: [C.c1a], lessons: [{ subjectId: S.maths, teacherId: T.wickramasinghe }] },
    });
    expect(pinBar()).toHaveTextContent('Mathematics · 1A');
    expect(pinBar()).toHaveTextContent('1A runs on the Primary (Gr 1–2) template: cells show its own period and time where they differ');
    expect(screen.getByRole('status')).toHaveTextContent('Pin mode on: Mathematics for 1A.');
  });

  it('offers pinning other slots when the row has no period of the class', async () => {
    const api = setup(T.wickramasinghe, { entries: [] });
    await activate('Monday', 8);
    await chooseSubjectInPopup('Sinhala');
    const option = within(screen.getByRole('listbox', { name: 'Classes' })).getByRole('option', { name: /^1A/ });
    expect(option).toHaveTextContent('No 1A period here');
    await userEvent.click(option);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Pin other slots' }));
    expect(api.saveEntry).not.toHaveBeenCalled();
    expect(pinBar()).toHaveTextContent('Sinhala · 1A');
  });

  it('sets the other teachers of a group option and saves the group', async () => {
    const api = setup(T.ananda, { entries: [] });
    await activate('Tuesday', 2);
    await chooseSubjectInPopup('Buddhism');
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Classes' })).getByRole('option', { name: /^6C · Religion \(Buddhism\)/ }));
    const group = screen.getByRole('dialog', { name: 'Set teachers for Religion' });
    expect(within(group).getByText('This teacher').closest('li')).toHaveTextContent('Ven. Ananda Thero');
    await userEvent.click(within(group).getByRole('button', { name: /^Catholicism teacher:/ }));
    await userEvent.type(within(group).getByRole('combobox', { name: 'Search Catholicism teachers' }), 'M. Silva{Enter}');
    await userEvent.click(within(group).getByRole('button', { name: /^Islam teacher:/ }));
    await userEvent.type(within(group).getByRole('combobox', { name: 'Search Islam teachers' }), 'Rizan{Enter}');
    await userEvent.click(within(group).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: {
          day: 1,
          period: 2,
          classIds: [C.c6c],
          lessons: [
            { subjectId: S.buddhism, teacherId: T.ananda },
            { subjectId: S.catholicism, teacherId: T.mSilva },
            { subjectId: S.islam, teacherId: T.rizan },
          ],
          groupKey: 'religion',
        },
      }),
    );
    expect(pinBar()).toHaveTextContent('Religion · 6C');
  });

  it('moves an edited lesson into a group block in another class, replacing the old lesson', async () => {
    const old = entry('old', 2, 4, [C.c12a], [[S.buddhism, T.ananda]]);
    const api = setup(T.ananda, { entries: [old] });
    await activate('Wednesday', 4);
    expect(screen.getByRole('dialog', { name: 'Choose a class' })).toHaveTextContent('Now: 12A · Buddhism');
    await userEvent.click(screen.getByRole('button', { name: /^6A/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Religion' });
    expect(within(dialog).getByRole('combobox', { name: /^Buddhism/ })).toHaveTextContent(/Ananda/);
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'old' })));
    expect(api.saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({ entry: expect.objectContaining({ day: 2, period: 4, classIds: [C.c6a], groupKey: 'religion' }) }),
    );
    expect(vi.mocked(api.saveEntry).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(api.deleteEntry).mock.invocationCallOrder[0]!);
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

  it('read-only: load bars but no picker, pin hint or delete', async () => {
    ro.value = true;
    const api = setup(T.perera);
    expect(screen.getByRole('meter', { name: 'Monday load' })).toBeInTheDocument();
    expect(screen.queryByText(/Click \+ to give this teacher a lesson/)).not.toBeInTheDocument();
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

  it('opens the teacher print view in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(open).toHaveBeenCalledWith(`/admin/print/teacher/${T.ananda}?year=y-2026&auto=1`, '_blank', 'noopener');
    open.mockRestore();
  });

  it('prefixes the print URL with the super-admin mirror base', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    setup(T.ananda, { route: `/s/siripura/timetable/teacher/${T.ananda}` });
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(open).toHaveBeenCalledWith(`/s/siripura/print/teacher/${T.ananda}?year=y-2026&auto=1`, '_blank', 'noopener');
    open.mockRestore();
  });
  describe('pin mode', () => {
    async function startMaths() {
      const a = setup(T.wickramasinghe, { entries: [] });
      await activate('Monday', 5);
      await chooseSubjectInPopup('Mathematics');
      await userEvent.click(within(screen.getByRole('listbox', { name: 'Classes' })).getByRole('option', { name: /^1A/ }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Assign' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      return a;
    }

    it('shows a hint before pin mode', () => {
      setup(T.rizan);
      expect(screen.getByText(/Click \+ to give this teacher a lesson/)).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Pin mode' })).not.toBeInTheDocument();
    });

    it('overlays the class week on the teacher rows with the class period where times differ', async () => {
      await startMaths();
      expect(grid().closest('section')).toHaveAttribute('data-pin-mode', 'true');
      expect(screen.getByLabelText('Pin mode legend')).toHaveTextContent('Free for Mrs. S. Wickramasinghe and 1A');
      expect(screen.getByLabelText('Pin mode legend')).toHaveTextContent('No 1A period in this row');
      const free = cellNamed(/^Tuesday, period 5, 10:50–11:30: pin Mathematics for 1A, 1A P5 · 10:40–11:05$/);
      expect(free).toHaveTextContent('1A P5 · 10:40–11:05');
      const none = cellNamed(/^Tuesday, period 6, 11:30–12:10: no 1A period at this time$/);
      expect(none).toHaveAttribute('aria-disabled', 'true');
      expect(none).toHaveTextContent('No 1A period');
      expect(cellNamed(/^Monday, period 5, 10:50–11:30: .*pinned, click to unpin$/)).toBeInTheDocument();
      expect(screen.getByRole('meter', { name: 'Monday load' })).toHaveAttribute('aria-valuetext', '1/8');
    });

    it('shows no class note where the class period matches the row', async () => {
      setup(T.rizan);
      await activate('Wednesday', 4);
      await chooseSubjectInPopup('English');
      await userEvent.click(within(screen.getByRole('listbox', { name: 'Classes' })).getByRole('option', { name: /^6B/ }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Assign' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(pinBar()).toHaveTextContent('English · 6B');
      const free = cellNamed(/^Friday, period 5, 10:50–11:30: pin English for 6B/);
      expect(free.getAttribute('aria-label')).not.toContain('6B P');
    });

    it('pins a free cell at the class period and unpins a pinned one', async () => {
      const api = await startMaths();
      await userEvent.click(cellNamed(/^Tuesday, period 5, .*: pin Mathematics/));
      await waitFor(() => expect(api.saveEntry).toHaveBeenCalledTimes(2));
      expect(vi.mocked(api.saveEntry).mock.calls[1]![0].entry).toEqual({ day: 1, period: 5, classIds: [C.c1a], lessons: [{ subjectId: S.maths, teacherId: T.wickramasinghe }] });
      expect(await screen.findByText('Mathematics pinned to Tuesday, period 5.')).toBeInTheDocument();
      await userEvent.click(cellNamed(/^Monday, period 5, .*pinned, click to unpin$/));
      await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'new' })));
    });

    it('does nothing on a row with no period of the class', async () => {
      const api = await startMaths();
      await userEvent.click(cellNamed(/^Tuesday, period 6, .*no 1A period/));
      expect(api.saveEntry).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
      ['Done', async () => userEvent.click(within(pinBar()).getByRole('button', { name: 'Done' }))],
      ['Escape', async () => userEvent.keyboard('{Escape}')],
    ])('exits with %s, announces it and returns focus to the starting cell', async (_, exit) => {
      const api = await startMaths();
      await exit();
      expect(screen.queryByRole('region', { name: 'Pin mode' })).not.toBeInTheDocument();
      expect(grid().closest('section')).not.toHaveAttribute('data-pin-mode');
      expect(screen.getByRole('status')).toHaveTextContent('Pin mode off.');
      expect(api.deleteEntry).not.toHaveBeenCalled();
      await waitFor(() => expect(slot('Monday', 5)).toHaveFocus());
    });

    it('does not exit when Escape is pressed in the teacher search', async () => {
      await startMaths();
      await userEvent.click(teacherButton());
      fireEvent.keyDown(screen.getByPlaceholderText('Search name or staff ID…'), { key: 'Escape' });
      expect(pinBar()).toBeInTheDocument();
    });

    it('ends pin mode when moving to another teacher', async () => {
      await startMaths();
      await userEvent.click(screen.getByRole('button', { name: 'Next teacher' }));
      expect(screen.queryByRole('region', { name: 'Pin mode' })).not.toBeInTheDocument();
    });
  });
});
