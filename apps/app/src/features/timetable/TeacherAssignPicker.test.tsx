// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { singleSpec, type DayIndex, type Entry } from '@sathiya/core';
import { C, ctx, entries, entry, S, T } from '@sathiya/core/fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { TeacherAssignPicker } from './TeacherAssignPicker';

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

beforeEach(() => {
  ro.value = false;
});

function setup(teacherId: string, slot: { day: DayIndex; row: number }, list: Entry[] = entries) {
  const onSave = vi.fn().mockResolvedValue(true);
  const onPin = vi.fn();
  const onClose = vi.fn();
  renderWithSchool(<TeacherAssignPicker teacherId={teacherId} slot={slot} entries={list} onClose={onClose} onSave={onSave} onPin={onPin} />, { ctx, entries: list });
  return { onSave, onPin, onClose };
}

const dialog = () => screen.getByRole('dialog');
const classList = () => within(dialog()).getByRole('listbox', { name: 'Classes' });
const classOption = (name: RegExp) => within(classList()).getByRole('option', { name });

async function pickSubject(name: string) {
  await userEvent.click(within(screen.getByRole('listbox', { name: 'Subjects' })).getByRole('option', { name: new RegExp(`^${name}`) }));
}

describe('TeacherAssignPicker', () => {
  it('lists the teacher’s subjects with what is still needed across his classes', () => {
    setup(T.rizan, { day: 2, row: 4 });
    expect(dialog()).toHaveAccessibleName('Choose a subject');
    expect(dialog()).toHaveTextContent('Wednesday · Period 4 · 09:50–10:30');
    const input = screen.getByRole('combobox', { name: 'Search subjects' });
    const options = within(screen.getByRole('listbox', { name: 'Subjects' })).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([expect.stringMatching(/^Islam/), expect.stringMatching(/^English/)]);
    expect(options[0]).toHaveTextContent('needs 3 across 3 classes');
    expect(options[1]).toHaveTextContent('needs 10 across 3 classes');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
  });

  it('filters subjects and picks with arrows and Enter, ignoring IME composing', async () => {
    setup(T.rizan, { day: 2, row: 4 });
    const input = screen.getByRole('combobox', { name: 'Search subjects' });
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, '{ArrowDown}');
    const options = within(screen.getByRole('listbox', { name: 'Subjects' })).getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(dialog()).toHaveAccessibleName('Choose a subject');
    await userEvent.type(input, '{Enter}');
    expect(dialog()).toHaveAccessibleName('Choose a class');
    expect(within(dialog()).getByRole('button', { name: 'Back to subjects' })).toHaveTextContent('English');
  });

  it('lists classes with the preferred one starred first, a template chip and a slot note', async () => {
    setup(T.rizan, { day: 2, row: 4 }, [...entries, entry('r1', 0, 1, [C.c6c], [[S.english, T.rizan]])]);
    await pickSubject('English');
    const options = within(classList()).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('6C');
    expect(options[0]).toHaveTextContent('★ Teaches 6C English');
    expect(options[0]).toHaveTextContent('Short Friday template');
    expect(options[1]).toHaveTextContent('6A');
    expect(options[1]).not.toHaveTextContent('★');
    expect(options[1]).not.toHaveTextContent('template');
    expect(classOption(/^6B/)).toHaveTextContent(/6B P4 · 09:50–10:30 · \d+ free this week/);
    expect(classOption(/^6B/)).toHaveTextContent('5/5');
    expect(options[1]).toHaveTextContent('needs 5');
  });

  it('notes a busy class slot with the reason', async () => {
    setup(T.rizan, { day: 0, row: 3 }, [...entries, entry('x', 0, 4, [C.c1a], [[S.english, T.rizan]])]);
    await pickSubject('English');
    expect(classOption(/^6A/)).toHaveTextContent(/Busy · Teaching 1A · English · \d+ free this week/);
  });

  it('notes a row whose class period holds another lesson as busy with that lesson', async () => {
    setup(T.rizan, { day: 1, row: 2 }, [...entries, entry('occ', 1, 2, [C.c6a], [[S.science, T.perera]])]);
    await pickSubject('English');
    expect(classOption(/^6A/)).toHaveTextContent(/Busy · 6A · Science · Mrs. N. Perera · \d+ free this week/);
    await userEvent.click(classOption(/^6A/));
    expect(within(dialog()).getByText('6A · Science · Mrs. N. Perera. Pin the other free slots instead.')).toBeInTheDocument();
  });

  it('notes a row with no period of the class', async () => {
    setup(T.rizan, { day: 4, row: 8 });
    await pickSubject('English');
    expect(classOption(/^6C/)).toHaveTextContent(/No 6C period here · \d+ free this week/);
  });

  it('filters classes and moves with arrows', async () => {
    setup(T.rizan, { day: 2, row: 4 });
    await pickSubject('English');
    const input = screen.getByRole('combobox', { name: 'Search classes' });
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.type(input, '{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', within(classList()).getAllByRole('option')[0]!.id);
    await userEvent.type(input, '6b');
    expect(within(classList()).getAllByRole('option')).toHaveLength(1);
  });

  it('asks for a class first, then assigns at the class period and starts pinning', async () => {
    const h = setup(T.rizan, { day: 2, row: 4 });
    await pickSubject('English');
    expect(within(dialog()).getByText('Choose a class.')).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Assign' })).toBeDisabled();
    await userEvent.click(classOption(/^6B/));
    expect(classOption(/^6B/)).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog()).getByText('Free: Wed 6B P4 · 09:50–10:30.')).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(h.onClose).toHaveBeenCalled());
    expect(h.onSave).toHaveBeenCalledWith({ day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.english, teacherId: T.rizan }] });
    expect(h.onPin).toHaveBeenCalledWith(singleSpec(C.c6b, S.english, T.rizan));
  });

  it('assigns with Enter from the class search', async () => {
    const h = setup(T.rizan, { day: 2, row: 4 });
    await pickSubject('English');
    const input = screen.getByRole('combobox', { name: 'Search classes' });
    await userEvent.type(input, '6b');
    await userEvent.type(input, '{ArrowDown}');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(h.onSave).not.toHaveBeenCalled();
    await userEvent.type(input, '{Enter}');
    await waitFor(() => expect(h.onSave).toHaveBeenCalled());
  });

  it('maps the row to the first free class period on another template', async () => {
    const h = setup(T.wickramasinghe, { day: 0, row: 5 }, []);
    await pickSubject('Mathematics');
    await userEvent.click(classOption(/^1A/));
    expect(within(dialog()).getByText('Free: Mon 1A P5 · 10:40–11:05 (this row is P5 · 10:50–11:30).')).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(h.onSave).toHaveBeenCalledWith({ day: 0, period: 5, classIds: [C.c1a], lessons: [{ subjectId: S.maths, teacherId: T.wickramasinghe }] }));
  });

  it.each([
    ['busy', { day: 0, row: 3 } as const, /^6A/, 'Teaching 1A · English. Pin the other free slots instead.'],
    ['no period', { day: 4, row: 8 } as const, /^6C/, 'No 6C period in this row. Pin the other free slots instead.'],
  ])('pins other slots without saving when the slot is %s', async (_, slot, cls, note) => {
    const h = setup(T.rizan, slot, [...entries, entry('x', 0, 4, [C.c1a], [[S.english, T.rizan]])]);
    await pickSubject('English');
    await userEvent.click(classOption(cls));
    expect(within(dialog()).getByText(note)).toBeInTheDocument();
    expect(within(dialog()).queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Pin other slots' }));
    expect(h.onSave).not.toHaveBeenCalled();
    expect(h.onPin).toHaveBeenCalledWith(singleSpec(cls.source.includes('6A') ? C.c6a : C.c6c, S.english, T.rizan));
    expect(h.onClose).toHaveBeenCalled();
  });

  it('teaches classes together as one combined entry', async () => {
    const h = setup(T.rizan, { day: 4, row: 5 });
    await pickSubject('English');
    await userEvent.click(classOption(/^6B/));
    expect(within(dialog()).getByText('Teach together (combined)')).toBeInTheDocument();
    const mate = within(dialog()).getByRole('button', { name: '+ 6A' });
    expect(mate).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(mate);
    expect(within(dialog()).getByRole('button', { name: '✓ 6A' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(h.onSave).toHaveBeenCalled());
    const spec = { classIds: [C.c6b, C.c6a], lessons: [{ subjectId: S.english, teacherId: T.rizan }] };
    expect(h.onSave).toHaveBeenCalledWith({ day: 4, period: 5, ...spec });
    expect(h.onPin).toHaveBeenCalledWith(spec);
  });

  it('moves a group class to the group step with the teacher locked and saves the group', async () => {
    const h = setup(T.rizan, { day: 4, row: 5 });
    await pickSubject('Islam');
    const row = classOption(/^6B · Religion \(Islam\)/);
    await userEvent.click(row);
    const group = screen.getByRole('dialog', { name: 'Set teachers for Religion' });
    expect(group).toHaveTextContent('Friday · Period 5 · 10:50–11:30');
    expect(within(group).getByText('This teacher').closest('li')).toHaveTextContent('Mr. A. Rizan');
    await userEvent.click(within(group).getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(h.onClose).toHaveBeenCalled());
    const spec = {
      classIds: [C.c6b, C.c6a],
      lessons: [
        { subjectId: S.buddhism, teacherId: T.ananda },
        { subjectId: S.catholicism, teacherId: T.mSilva },
        { subjectId: S.islam, teacherId: T.rizan },
      ],
      groupKey: 'religion',
    };
    expect(h.onSave).toHaveBeenCalledWith({ day: 4, period: 5, ...spec });
    expect(h.onPin).toHaveBeenCalledWith(spec);
  });

  it('opens the group step for the whole week when the row has no period of the class', async () => {
    const h = setup(T.rizan, { day: 4, row: 8 });
    await pickSubject('Islam');
    await userEvent.click(classOption(/^6C · Religion/));
    const group = screen.getByRole('dialog', { name: 'Set teachers for Religion' });
    await userEvent.click(within(group).getByRole('button', { name: 'Back to classes' }));
    expect(screen.getByRole('dialog', { name: 'Choose a class' })).toBeInTheDocument();
    await userEvent.click(classOption(/^6C · Religion/));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Start pinning' })).toBeInTheDocument();
    expect(h.onSave).not.toHaveBeenCalled();
  });

  it('goes back to the subjects', async () => {
    setup(T.rizan, { day: 2, row: 4 });
    await pickSubject('English');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Back to subjects' }));
    expect(dialog()).toHaveAccessibleName('Choose a subject');
  });

  it('renders nothing in the read-only view', () => {
    ro.value = true;
    setup(T.rizan, { day: 2, row: 4 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
