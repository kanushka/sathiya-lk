// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { fillWithClassTeacher } from '@sathiya/core';
import { C, ctx, entries6B, S, T } from '@sathiya/core/fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});

describe('ClassViewPage', () => {
  it('shows the class header, class teacher and grid cells', () => {
    setup();
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveValue(C.c6b);
    expect(screen.getByText(/^Class teacher:/)).toHaveTextContent('Class teacher: Mrs. N. Perera · School default');
    expect(slot('Monday', 1)).toHaveTextContent('Maths');
    expect(slot('Monday', 1)).toHaveTextContent('Mrs. N. Perera');
    expect(slot('Wednesday', 2)).toHaveTextContent('Religion');
    expect(slot('Wednesday', 2)).toHaveTextContent('⧉ 6A+6B');
    expect(slot('Friday', 3)).toHaveTextContent('Group · 3 teachers');
  });

  it('moves between classes with prev/next', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Next class' }));
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveValue(C.c6c);
    await userEvent.click(screen.getByRole('button', { name: 'Previous class' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous class' }));
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveValue(C.c6a);
  });

  it('assigns a lesson to an empty slot through the picker', async () => {
    const api = setup();
    await activate('Wednesday', 4);
    await userEvent.click(screen.getByRole('button', { name: 'Subject' }));
    await userEvent.click(screen.getByRole('option', { name: /^Science/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Mrs. S. Gunasekara/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.saveEntry).toHaveBeenCalledWith({
      schoolId: ctx.school.id,
      yearId: 'y-2026',
      entry: { day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.science, teacherId: T.gunasekara }] },
    });
    expect(slot('Wednesday', 4)).toHaveTextContent('Science');
  });

  it('opens the block editor for a group subject', async () => {
    setup();
    await activate('Wednesday', 4);
    await userEvent.click(screen.getByRole('button', { name: 'Subject' }));
    await userEvent.click(screen.getByRole('option', { name: /^Religion/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Religion' });
    expect(within(dialog).getByText('Classes')).toBeInTheDocument();
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
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveValue(C.c6c);
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
    await userEvent.click(slot('Wednesday', 4));
    await userEvent.click(slot('Wednesday', 4));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyDown(slot('Monday', 1), { key: 'Delete' });
    expect(api.deleteEntry).not.toHaveBeenCalled();
    expect(screen.getByText('Mathematics').closest('li')).toHaveTextContent('6/6');
  });

  it('redirects the index route to the first class', () => {
    setup(C.c6b, makeApi(), '/admin/timetable/class');
    expect(screen.getByRole('combobox', { name: 'Class' })).toHaveValue(C.c1a);
  });

  it('shows an empty state when there are no classes', () => {
    renderWithSchool(
      <Routes>
        <Route path="/admin/timetable/class" element={<ClassIndexRedirect />} />
      </Routes>,
      { ctx: { ...ctx, classes: [] }, route: '/admin/timetable/class' },
    );
    expect(screen.getByText('No classes yet')).toBeInTheDocument();
  });
});
