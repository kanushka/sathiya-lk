// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { fillWithClassTeacher } from '@sathiya/core';
import { C, ctx, entries6B, entry, G, S, T } from '@sathiya/core/fixtures';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import { ClassIndexRedirect, ClassViewPage } from './ClassViewPage';
import { TimetableApiContext, type TimetableApi } from './useTimetable';

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

function makeApi(): TimetableApi {
  return {
    saveEntry: vi.fn().mockResolvedValue({ entryId: 'new' }),
    deleteEntry: vi.fn().mockResolvedValue({ ok: true }),
  };
}

function setup(classId: string = C.c6b, api: TimetableApi = makeApi(), route = `/admin/timetable/class/${classId}`) {
  renderWithSchool(
    <TimetableApiContext.Provider value={api}>
      <Routes>
        <Route path="/admin/timetable/class" element={<ClassIndexRedirect />} />
        <Route path="/admin/timetable/class/:classId" element={<ClassViewPage />} />
        <Route path="/s/:sid/timetable/class/:classId" element={<ClassViewPage />} />
      </Routes>
    </TimetableApiContext.Provider>,
    { ctx, entries: entries6B, route },
  );
  return api;
}

const slot = (day: string, n: number) => screen.getByRole('button', { name: new RegExp(`^${day}, period ${n},`) });

async function activate(day: string, n: number) {
  await userEvent.click(slot(day, n));
  await userEvent.click(slot(day, n));
}

beforeEach(() => {
  ro.value = false;
  sessionStorage.clear();
});

describe('ClassViewPage', () => {
  it('keeps prev, class picker and next on one row that fills the width on phones', () => {
    setup();
    const picker = screen.getByRole('combobox', { name: /^Class/ });
    const wrap = picker.closest('.flex-1')!;
    expect(wrap).toHaveClass('min-w-0', 'flex-1', 'md:w-52', 'md:flex-none');
    expect(wrap.parentElement).toHaveClass('w-full', 'md:w-auto');
    expect(screen.getByText(/^Class teacher:/)).toHaveClass('basis-full', 'md:basis-auto');
  });

  it('hint says choose, not click', () => {
    setup();
    expect(screen.getByText(/to add a lesson/)).toHaveTextContent(/^Choose \+ to add a lesson/);
  });

  it('shows the class header, class teacher and grid cells', () => {
    setup();
    expect(screen.getByRole('combobox', { name: /^Class/ })).toHaveTextContent('Grade 6 · 6B');
    expect(screen.getByText(/^Class teacher:/)).toHaveTextContent('Class teacher: Mrs. N. Perera · School default');
    expect(slot('Monday', 1)).toHaveTextContent('Maths');
    expect(slot('Monday', 1)).toHaveTextContent('Mrs. N. Perera');
    expect(slot('Wednesday', 2)).toHaveTextContent('Religion');
    expect(slot('Wednesday', 2)).toHaveTextContent('⧉ 6A+6B');
    expect(slot('Friday', 3)).toHaveTextContent('Group · 3 teachers');
  });

  it('labels a combined non-group lesson with the joined classes', () => {
    const combined = [...entries6B, entry('x-6b-0-5', 0, 5, [C.c6a, C.c6b], [[S.maths, T.perera]])];
    renderWithSchool(
      <TimetableApiContext.Provider value={makeApi()}>
        <Routes>
          <Route path="/admin/timetable/class/:classId" element={<ClassViewPage />} />
        </Routes>
      </TimetableApiContext.Provider>,
      { ctx, entries: combined, route: `/admin/timetable/class/${C.c6b}` },
    );
    expect(slot('Monday', 5)).toHaveTextContent('⧉ 6A+6B');
  });

  it('moves between classes with prev/next', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Next class' }));
    expect(screen.getByRole('combobox', { name: /^Class/ })).toHaveTextContent('Grade 6 · 6C');
    await userEvent.click(screen.getByRole('button', { name: 'Previous class' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous class' }));
    expect(screen.getByRole('combobox', { name: /^Class/ })).toHaveTextContent('Grade 6 · 6A');
  });

  it('assigns a lesson to an empty slot through the two-step popup', async () => {
    const api = setup();
    await activate('Wednesday', 4);
    const popup = screen.getByRole('dialog', { name: 'Choose a subject' });
    await userEvent.type(within(popup).getByRole('combobox', { name: 'Search subjects' }), 'Science{Enter}');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('option', { name: /^Mrs\. S\. Gunasekara/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveEntry).toHaveBeenCalledWith({
      schoolId: ctx.school.id,
      yearId: 'y-2026',
      entry: { day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.science, teacherId: T.gunasekara }] },
    });
    expect(slot('Wednesday', 4)).toHaveTextContent('Science');
  });

  it('opens the group teachers step for a group subject', async () => {
    setup();
    await activate('Wednesday', 4);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('option', { name: /^Religion/ }));
    expect(screen.getByRole('dialog', { name: 'Set teachers for Religion' })).toBeInTheDocument();
  });

  it('opens the block editor with the entry for a group cell', async () => {
    setup();
    await activate('Wednesday', 2);
    expect(screen.getByRole('dialog', { name: 'Religion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove block' })).toBeInTheDocument();
  });

  it('clears a filled slot from the picker', async () => {
    const api = setup();
    await activate('Monday', 1);
    await userEvent.click(screen.getByRole('button', { name: 'Clear slot' }));
    await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith({ schoolId: ctx.school.id, yearId: 'y-2026', entryId: 'e-6b-0-1' }));
  });

  it('clears a filled slot with the Delete key', async () => {
    const api = setup();
    await userEvent.click(slot('Monday', 1));
    fireEvent.keyDown(slot('Monday', 1), { key: 'Delete' });
    await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e-6b-0-1' })));
  });

  it('opens the block editor instead of deleting a multi-class cell on Delete', async () => {
    const api = setup();
    await userEvent.click(slot('Wednesday', 2));
    fireEvent.keyDown(slot('Wednesday', 2), { key: 'Delete' });
    expect(screen.getByRole('dialog', { name: 'Religion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove block' })).toBeInTheDocument();
    expect(api.deleteEntry).not.toHaveBeenCalled();
  });

  it('keeps a saved block visible after the block editor closes', async () => {
    const api = setup();
    await activate('Wednesday', 2);
    const dialog = await screen.findByRole('dialog', { name: 'Religion' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveEntry).toHaveBeenCalled();
    expect(slot('Wednesday', 2)).toHaveTextContent('Religion');
  });

  it('fills empty periods with the class teacher after confirming, one at a time', async () => {
    const api = makeApi();
    const resolvers: Array<() => void> = [];
    vi.mocked(api.saveEntry).mockImplementation(
      () => new Promise((res) => resolvers.push(() => res({ entryId: `f${resolvers.length}` }))),
    );
    setup(C.c6b, api);
    const drafts = fillWithClassTeacher({ ctx, entries: entries6B, classId: C.c6b });
    expect(drafts).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: 'Fill empty with class teacher' }));
    const dialog = screen.getByRole('dialog', { name: 'Fill empty periods' });
    expect(dialog).toHaveTextContent('4 empty periods will be filled with Mrs. N. Perera');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fill 4 periods' }));
    for (let i = 0; i < 4; i++) {
      await waitFor(() => expect(api.saveEntry).toHaveBeenCalledTimes(i + 1));
      expect(vi.mocked(api.saveEntry).mock.calls[i]![0].entry).toEqual(drafts[i]);
      resolvers[i]!();
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveEntry).toHaveBeenCalledTimes(4);
  });

  it('opens the print view in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(open).toHaveBeenCalledWith(`/admin/print/class/${C.c6b}?year=y-2026&auto=1`, '_blank', 'noopener');
    open.mockRestore();
  });

  it('prefixes links with the super-admin mirror base', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    setup(C.c6b, makeApi(), `/s/siripura/timetable/class/${C.c6b}`);
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(open).toHaveBeenCalledWith(`/s/siripura/print/class/${C.c6b}?year=y-2026&auto=1`, '_blank', 'noopener');
    await userEvent.click(screen.getByRole('button', { name: 'Next class' }));
    expect(screen.getByRole('combobox', { name: /^Class/ })).toHaveTextContent('Grade 6 · 6C');
    open.mockRestore();
  });

  it('shows subject progress', () => {
    setup();
    expect(screen.getByText('Mathematics').closest('li')).toHaveTextContent('6/6');
  });

  it('read-only: no picker, no fill, no clear', async () => {
    ro.value = true;
    const api = setup();
    expect(screen.queryByRole('button', { name: 'Fill empty with class teacher' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pin / })).not.toBeInTheDocument();
    expect(screen.queryByText(/Pin mode keeps the same subject/)).not.toBeInTheDocument();
    await userEvent.click(slot('Wednesday', 4));
    await userEvent.click(slot('Wednesday', 4));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(slot('Monday', 1), { key: 'Delete' });
    expect(api.deleteEntry).not.toHaveBeenCalled();
    expect(screen.getByText('Mathematics').closest('li')).toHaveTextContent('6/6');
  });

  describe('remembered selection', () => {
    const combobox = () => screen.getByRole('combobox', { name: /^Class/ });

    it('reopens the last viewed class from the index route', () => {
      const first = setup(C.c6c);
      expect(combobox()).toHaveTextContent('6C');
      cleanup();
      setup(C.c6b, first, '/admin/timetable/class');
      expect(combobox()).toHaveTextContent('Grade 6 · 6C');
    });

    it('selects the class from ?class= and ?c=', () => {
      setup(C.c6c, makeApi(), `/admin/timetable/class?class=${C.c6c}`);
      expect(combobox()).toHaveTextContent('Grade 6 · 6C');
      cleanup();
      setup(C.c6b, makeApi(), `/admin/timetable/class?c=${C.c6b}`);
      expect(combobox()).toHaveTextContent('Grade 6 · 6B');
    });

    it('falls back to the first class for an unknown id', () => {
      sessionStorage.setItem('sathiya.timetable.class', 'gone');
      setup(C.c6b, makeApi(), '/admin/timetable/class?class=nope');
      expect(combobox()).toHaveTextContent('Grade 1 · 1A');
    });
  });

  it('redirects the index route to the first class', () => {
    setup(C.c6b, makeApi(), '/admin/timetable/class');
    expect(screen.getByRole('combobox', { name: /^Class/ })).toHaveTextContent('Grade 1 · 1A');
  });

  it('shows an empty state when there are no classes', () => {
    renderWithSchool(
      <Routes>
        <Route path="/admin/timetable/class" element={<ClassIndexRedirect />} />
      </Routes>,
      { ctx: { ...ctx, classes: [] }, route: '/admin/timetable/class' },
    );
    expect(screen.getByText('No classes yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up grades & classes' })).toHaveAttribute('href', '/admin/grades');
  });

  it('shows no setup link in read-only view', () => {
    ro.value = true;
    renderWithSchool(
      <Routes>
        <Route path="/admin/timetable/class" element={<ClassIndexRedirect />} />
      </Routes>,
      { ctx: { ...ctx, classes: [] }, route: '/admin/timetable/class' },
    );
    expect(screen.getByText('No classes yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Set up grades & classes' })).toBeNull();
  });

  describe('pin mode', () => {
    const pinBar = () => screen.getByRole('region', { name: 'Pin mode' });
    const grid = () => screen.getByRole('group', { name: 'Timetable grid' });
    const cellNamed = (name: RegExp) => within(grid()).getByRole('button', { name });

    async function assignScience(api: TimetableApi = makeApi()) {
      setup(C.c6b, api);
      await activate('Wednesday', 4);
      await userEvent.type(screen.getByRole('combobox', { name: 'Search subjects' }), 'Science{Enter}');
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('option', { name: /^Mrs\. S\. Gunasekara/ }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Assign' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      return api;
    }

    it('shows a hint before any pin mode starts', () => {
      setup();
      expect(screen.getByText(/Pin mode keeps the same subject and teacher/)).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Pin mode' })).not.toBeInTheDocument();
    });

    it('enters pin mode after Assign with the subject, teacher, progress and grid outline', async () => {
      await assignScience();
      expect(pinBar()).toHaveTextContent('Science · Mrs. S. Gunasekara');
      expect(pinBar()).toHaveTextContent('4 of 5 placed · 1 to go');
      expect(grid().closest('section')).toHaveAttribute('data-pin-mode', 'true');
      expect(screen.getByRole('button', { name: 'Done pinning Science' }).closest('li')).toHaveAttribute('data-active', 'true');
      await waitFor(() => expect(slot('Wednesday', 4)).toHaveFocus());
    });

    it('overlays the teacher week: pins on free cells, busy reasons, other lessons disabled', async () => {
      const busy = entry('busy', 4, 5, [C.c6a], [[S.science, T.gunasekara]]);
      renderWithSchool(
        <TimetableApiContext.Provider value={makeApi()}>
          <Routes>
            <Route path="/admin/timetable/class/:classId" element={<ClassViewPage />} />
          </Routes>
        </TimetableApiContext.Provider>,
        { ctx, entries: [...entries6B, busy], route: `/admin/timetable/class/${C.c6b}` },
      );
      await userEvent.click(screen.getByRole('button', { name: 'Pin Science' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Start pinning' }));
      const free = cellNamed(/^Thursday, period 7, 12:10–12:50: pin Science with Mrs\. S\. Gunasekara$/);
      expect(free.querySelector('svg')).not.toBeNull();
      const busyCell = cellNamed(/^Friday, period 5, .*: busy, Teaching 6A · Science$/);
      expect(busyCell).toHaveAttribute('aria-disabled', 'true');
      expect(busyCell).toHaveTextContent('Busy');
      expect(cellNamed(/^Monday, period 1, .*Maths/)).toHaveAttribute('aria-disabled', 'true');
      expect(cellNamed(/^Friday, period 1, .*Science Mrs\. S\. Gunasekara, pinned, click to unpin$/)).not.toHaveAttribute('aria-disabled');
    });

    it('pins a free cell with one click and unpins a pinned one, keeping other lessons untouched', async () => {
      const api = await assignScience();
      await userEvent.click(cellNamed(/^Thursday, period 7, .*: pin Science/));
      await waitFor(() => expect(api.saveEntry).toHaveBeenCalledTimes(2));
      expect(vi.mocked(api.saveEntry).mock.calls[1]![0].entry).toEqual({ day: 3, period: 7, classIds: [C.c6b], lessons: [{ subjectId: S.science, teacherId: T.gunasekara }] });
      expect(await screen.findByText('Science pinned to Thursday, period 7.')).toBeInTheDocument();
      expect(pinBar()).toHaveTextContent('5 of 5 placed · complete');
      await userEvent.click(cellNamed(/^Friday, period 1, .*pinned, click to unpin$/));
      await waitFor(() => expect(api.deleteEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e-6b-4-1' })));
      await userEvent.click(cellNamed(/^Monday, period 1, .*Maths/));
      expect(api.deleteEntry).toHaveBeenCalledTimes(1);
    });

    it('pins the focused cell with Enter', async () => {
      const api = await assignScience();
      const target = cellNamed(/^Thursday, period 7, .*: pin Science/);
      target.focus();
      fireEvent.keyDown(target, { key: 'Enter' });
      await waitFor(() => expect(api.saveEntry).toHaveBeenCalledTimes(2));
    });

    it('warns in the bar when pinned over the weekly plan', async () => {
      await assignScience();
      await userEvent.click(cellNamed(/^Thursday, period 7, .*: pin Science/));
      await userEvent.click(await screen.findByRole('button', { name: /^Friday, period 5, .*: pin Science.*over plan$/ }));
      await waitFor(() => expect(pinBar()).toHaveTextContent('6 of 5 placed'));
      expect(within(pinBar()).getByText('+1 over')).toBeInTheDocument();
    });

    it('uses the fill-over orange for over-plan cells', async () => {
      await assignScience();
      await userEvent.click(cellNamed(/^Thursday, period 7, .*: pin Science/));
      const over = await screen.findByRole('button', { name: /^Friday, period 5, .*: pin Science.*over plan$/ });
      expect(over).toHaveClass('border-fill-over');
    });

    it('rolls back a clashing pin and shows the conflict', async () => {
      const api = makeApi();
      vi.mocked(api.saveEntry)
        .mockResolvedValueOnce({ entryId: 'new' })
        .mockRejectedValueOnce(new ApiError('clash', 'clash', { conflicts: [{ kind: 'teacher', id: T.gunasekara, entryId: 'x' }] }));
      await assignScience(api);
      await userEvent.click(cellNamed(/^Thursday, period 7, .*: pin Science/));
      expect(await screen.findByText('Clash: Mrs. S. Gunasekara is already teaching at this time')).toBeInTheDocument();
      expect(cellNamed(/^Thursday, period 7, .*: pin Science/)).toBeInTheDocument();
    });

    it('suggests and pins the remaining periods', async () => {
      const api = await assignScience();
      await userEvent.click(within(pinBar()).getByRole('button', { name: 'Suggest 1 slot' }));
      expect(cellNamed(/^Thursday, period 7, .*: pin Science with Mrs\. S\. Gunasekara, suggested$/)).toHaveTextContent('Suggested');
      await userEvent.click(within(pinBar()).getByRole('button', { name: 'Pin 1 suggested' }));
      await waitFor(() => expect(api.saveEntry).toHaveBeenCalledTimes(2));
      expect(await screen.findByText('Pinned 1 Science lesson.')).toBeInTheDocument();
    });

    it.each([
      ['Done', async () => userEvent.click(within(pinBar()).getByRole('button', { name: 'Done' }))],
      ['Escape', async () => userEvent.keyboard('{Escape}')],
      ['the active subject row', async () => userEvent.click(screen.getByRole('button', { name: 'Done pinning Science' }))],
    ])('exits with %s, keeping the pins', async (_, exit) => {
      const api = await assignScience();
      await exit();
      expect(screen.queryByRole('region', { name: 'Pin mode' })).not.toBeInTheDocument();
      expect(grid().closest('section')).not.toHaveAttribute('data-pin-mode');
      expect(api.deleteEntry).not.toHaveBeenCalled();
      expect(slot('Wednesday', 4)).toHaveTextContent('Science');
    });

    it('announces pin mode on and off in the persistent status region', async () => {
      await assignScience();
      expect(screen.getByRole('status')).toHaveTextContent('Pin mode on: Science with Mrs. S. Gunasekara.');
      await userEvent.click(within(pinBar()).getByRole('button', { name: 'Done' }));
      expect(screen.getByRole('status')).toHaveTextContent('Pin mode off.');
    });

    it('returns focus to the cell that started pin mode after Done', async () => {
      await assignScience();
      await userEvent.click(within(pinBar()).getByRole('button', { name: 'Done' }));
      await waitFor(() => expect(slot('Wednesday', 4)).toHaveFocus());
    });

    it('returns focus to the list pin button after Done when started from the list', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'Pin Sinhala' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Start pinning' }));
      await userEvent.click(within(pinBar()).getByRole('button', { name: 'Done' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Pin Sinhala' })).toHaveFocus());
    });

    it('does not exit when Escape is pressed in a form control', async () => {
      await assignScience();
      fireEvent.keyDown(screen.getByRole('combobox', { name: /^Class/ }), { key: 'Escape' });
      expect(pinBar()).toBeInTheDocument();
    });

    it('closes the open class menu on Escape without exiting', async () => {
      await assignScience();
      await userEvent.click(screen.getByRole('combobox', { name: /^Class/ }));
      expect(screen.getByRole('listbox', { name: 'Class' })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(pinBar()).toBeInTheDocument();
    });

    it('never offers or shows more suggestions than still needed', async () => {
      await assignScience();
      await userEvent.click(within(pinBar()).getByRole('button', { name: 'Suggest 1 slot' }));
      await userEvent.click(cellNamed(/^Friday, period 5, .*: pin Science/));
      await waitFor(() => expect(pinBar()).toHaveTextContent('5 of 5 placed · complete'));
      expect(within(pinBar()).queryByRole('button', { name: /suggested$/ })).not.toBeInTheDocument();
      expect(cellNamed(/^Thursday, period 7, .*: pin Science with Mrs\. S\. Gunasekara, over plan$/)).toHaveTextContent('Over plan');
    });

    it('does not announce pin mode off when starting from the list while not pinning', async () => {
      setup();
      await userEvent.click(screen.getByRole('button', { name: 'Pin Sinhala' }));
      expect(screen.getByRole('status')).not.toHaveTextContent('Pin mode off.');
    });

    it('starts from the lesson list pin button on the teacher step for the whole week', async () => {
      const api = setup();
      await userEvent.click(screen.getByRole('button', { name: 'Pin Sinhala' }));
      const popup = screen.getByRole('dialog', { name: 'Choose a teacher' });
      expect(popup).toHaveTextContent('Whole week');
      await userEvent.click(within(popup).getByRole('button', { name: 'Start pinning' }));
      expect(pinBar()).toHaveTextContent('Sinhala · Mr. R. Silva');
      expect(api.saveEntry).not.toHaveBeenCalled();
    });

    describe('group', () => {
      const religionLessons = [
        { subjectId: S.buddhism, teacherId: T.ananda },
        { subjectId: S.catholicism, teacherId: T.mSilva },
        { subjectId: S.islam, teacherId: T.rizan },
      ];

      function setupWith(list: typeof entries6B, api: TimetableApi = makeApi(), school = ctx) {
        renderWithSchool(
          <TimetableApiContext.Provider value={api}>
            <Routes>
              <Route path="/admin/timetable/class/:classId" element={<ClassViewPage />} />
            </Routes>
          </TimetableApiContext.Provider>,
          { ctx: school, entries: list, route: `/admin/timetable/class/${C.c6b}` },
        );
        return api;
      }

      it('assigns a group at the slot and enters group pin mode', async () => {
        const api = setupWith(entries6B.filter((e) => e.id !== 'e-religion-3-6'));
        await activate('Wednesday', 4);
        await userEvent.click(within(screen.getByRole('dialog')).getByRole('option', { name: /^Religion/ }));
        await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Assign' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(api.saveEntry).toHaveBeenCalledWith({
          schoolId: ctx.school.id,
          yearId: 'y-2026',
          entry: { day: 2, period: 4, classIds: [C.c6b, C.c6a], lessons: religionLessons, groupKey: 'religion' },
        });
        expect(pinBar()).toHaveTextContent('Religion · 6A+6B');
        expect(pinBar()).toHaveTextContent('Buddhism – Ven. Ananda Thero · Catholicism – Rev. Fr. M. Silva · Islam – Mr. A. Rizan');
        expect(pinBar()).toHaveTextContent('3 of 3 placed');
        expect(screen.getByLabelText('Pin mode legend')).toHaveTextContent('Free for all 3 teachers and 6A+6B');
        expect(cellNamed(/^Wednesday, period 4, 09:50–10:30: Religion 6A\+6B, pinned, click to unpin$/)).toBeInTheDocument();
        expect(cellNamed(/^Thursday, period 7, 12:10–12:50: pin Religion for 6A\+6B, over plan$/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done pinning Religion' }).closest('li')).toHaveAttribute('data-active', 'true');
      });

      it('starts group pin mode from the list with the latest lesson’s teachers and classes', async () => {
        const api = setup();
        await userEvent.click(screen.getByRole('button', { name: 'Pin Religion' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(pinBar()).toHaveTextContent('Religion · 6A+6B');
        expect(api.saveEntry).not.toHaveBeenCalled();
        await userEvent.click(within(pinBar()).getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Pin Religion' })).toHaveFocus());
      });

      it('opens the group step for the whole week from the list when there is no lesson yet', async () => {
        setupWith(entries6B.filter((e) => e.groupKey !== 'religion'));
        await userEvent.click(screen.getByRole('button', { name: 'Pin Religion' }));
        const popup = screen.getByRole('dialog', { name: 'Set teachers for Religion' });
        expect(popup).toHaveTextContent('Whole week');
      });

      it('opens the group step instead of a stale pin mode when a latest teacher is gone', async () => {
        setupWith(entries6B, makeApi(), { ...ctx, teachers: ctx.teachers.filter((x) => x.id !== T.rizan) });
        await userEvent.click(screen.getByRole('button', { name: 'Pin Religion' }));
        expect(screen.getByRole('dialog', { name: 'Set teachers for Religion' })).toHaveTextContent('Whole week');
        expect(screen.queryByRole('region', { name: 'Pin mode' })).not.toBeInTheDocument();
      });

      it('opens the group step when the latest lesson no longer matches the plan options', async () => {
        const g6 = ctx.grades.find((g) => g.id === G.g6)!;
        const plan = g6.plan.map((p) => (p.kind === 'group' && p.key === 'religion' ? { ...p, optionSubjectIds: [S.buddhism, S.catholicism] } : p));
        setupWith(entries6B, makeApi(), { ...ctx, grades: ctx.grades.map((g) => (g.id === G.g6 ? { ...g, plan } : g)) });
        await userEvent.click(screen.getByRole('button', { name: 'Pin Religion' }));
        expect(screen.getByRole('dialog', { name: 'Set teachers for Religion' })).toHaveTextContent('Whole week');
      });

      it('labels free cells for the group', async () => {
        setupWith(entries6B.filter((e) => !(e.groupKey === 'religion' && e.day === 3)));
        await userEvent.click(screen.getByRole('button', { name: 'Pin Religion' }));
        const free = cellNamed(/^Thursday, period 7, 12:10–12:50: pin Religion for 6A\+6B$/);
        expect(free).toHaveTextContent('All free');
      });
    });

    it('edits a filled cell as before when not pinning', async () => {
      setup();
      await activate('Monday', 1);
      expect(screen.getByRole('button', { name: 'Clear slot' })).toBeInTheDocument();
    });
  });
});

describe('ClassViewPage outside the period template', () => {
  const orphan = entry('o-6c', 4, 8, [C.c6c], [[S.science, T.gunasekara]]);

  function setupOrphan(route = `/admin/timetable/class/${C.c6c}`) {
    const api = makeApi();
    renderWithSchool(
      <TimetableApiContext.Provider value={api}>
        <Routes>
          <Route path="/admin/timetable/class/:classId" element={<ClassViewPage />} />
        </Routes>
      </TimetableApiContext.Provider>,
      { ctx, entries: [orphan], route },
    );
    return api;
  }

  it('lists the orphaned entry and deletes it after confirming', async () => {
    const api = setupOrphan();
    const section = screen.getByRole('region', { name: 'Outside the period template' });
    expect(section).toHaveTextContent('Fri P8 · 6C · Science · Mrs. S. Gunasekara');
    await userEvent.click(within(section).getByRole('button', { name: 'Delete Fri P8 Science' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete this entry?' })).getByRole('button', { name: 'Delete' }));
    expect(api.deleteEntry).toHaveBeenCalledWith({ schoolId: ctx.school.id, yearId: 'y-2026', entryId: 'o-6c' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Outside the period template' })).not.toBeInTheDocument());
  });

  it('scrolls the list into view when linked to it', () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      setupOrphan(`/admin/timetable/class/${C.c6c}#outside-template`);
      expect(scroll).toHaveBeenCalled();
      expect(scroll.mock.contexts[0]).toHaveAttribute('id', 'outside-template');
    } finally {
      scroll.mockRestore();
    }
  });

  it('shows no list when every entry fits the template', () => {
    setup();
    expect(screen.queryByRole('region', { name: 'Outside the period template' })).not.toBeInTheDocument();
  });
});
