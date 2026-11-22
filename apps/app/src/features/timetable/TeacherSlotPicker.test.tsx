// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, Entry } from '@sathiya/core';
import { C, ctx, entries6B, entry, S, T } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { TeacherSlotPicker, type TeacherSlotPickerProps } from './TeacherSlotPicker';

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

function setup(props: Partial<TeacherSlotPickerProps> = {}, entries: Entry[] = entries6B) {
  const handlers = {
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(true),
    onClear: vi.fn().mockResolvedValue(true),
    onGroup: vi.fn(),
  };
  const teacherId = props.teacherId ?? T.ananda;
  const day = props.day ?? 2;
  const period = props.period ?? 5;
  const editing = props.editing ?? entry('ed', day, period, [C.c12a], [[S.pali, teacherId]]);
  renderWithSchool(
    <TeacherSlotPicker open {...handlers} {...props} teacherId={teacherId} day={day} period={period} entries={entries} editing={editing} />,
    { ctx, entries },
  );
  return handlers;
}

async function chooseSubject(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Subject' }));
  await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));
}

beforeEach(() => {
  ro.value = false;
});

describe('TeacherSlotPicker', () => {
  it("offers the teacher's subjects, then classes free in that period", async () => {
    setup();
    expect(screen.getByText('Wednesday · Period 5 · 10:50–11:30')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Subject' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Buddhism', 'Pali']);
    await userEvent.click(screen.getByRole('option', { name: 'Buddhism' }));
    expect(screen.getByRole('dialog', { name: 'Choose a class' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^6A/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^12A/ })).toBeEnabled();
    const busy = screen.getByRole('button', { name: /^6B/ });
    expect(busy).toBeDisabled();
    expect(busy).toHaveTextContent('6B · Aesthetic');
  });

  it("shows another teacher's lesson that takes the class: class, subject and teacher", async () => {
    setup({ teacherId: T.perera, day: 2, period: 5 }, [...entries6B, entry('x', 2, 5, [C.c6a], [[S.science, T.gunasekara]])]);
    await chooseSubject('Mathematics');
    const row = screen.getByRole('button', { name: /^6A/ });
    expect(row).toBeDisabled();
    expect(row).toHaveTextContent('6A · Science · Mrs. S. Gunasekara');
  });

  it('shows where the teacher is teaching when they are busy elsewhere', async () => {
    setup({ teacherId: T.perera, day: 2, period: 4 }, [...entries6B, entry('x', 2, 4, [C.c6a], [[S.science, T.perera]])]);
    await chooseSubject('Mathematics');
    const row = screen.getByRole('button', { name: /^6C/ });
    expect(row).toBeDisabled();
    expect(row).toHaveTextContent('Teaching 6A · Science');
  });

  it('assigns a plain subject with a one-class draft', async () => {
    const h = setup();
    await chooseSubject('Buddhism');
    await userEvent.click(screen.getByRole('button', { name: /^12A/ }));
    expect(h.onSave).toHaveBeenCalledWith({ id: 'ed', day: 2, period: 5, classIds: [C.c12a], lessons: [{ subjectId: S.buddhism, teacherId: T.ananda }] });
    await waitFor(() => expect(h.onClose).toHaveBeenCalled());
  });

  it('hands a group option to the block editor with the class and period', async () => {
    const h = setup();
    await chooseSubject('Buddhism');
    expect(screen.getByRole('button', { name: /^6A/ })).toHaveTextContent('Religion block');
    await userEvent.click(screen.getByRole('button', { name: /^6A/ }));
    expect(h.onGroup).toHaveBeenCalledWith({ classId: C.c6a, period: 5, subjectId: S.buddhism, item: expect.objectContaining({ key: 'religion' }) });
    expect(h.onSave).not.toHaveBeenCalled();
  });

  it('warns when the teacher is at the daily limit but still allows assigning', async () => {
    const full = [1, 2, 3, 6, 7].map((p) => entry(`f${p}`, 2, p, [C.c12a], [[S.buddhism, T.ananda]]));
    const h = setup({}, [...entries6B, ...full]);
    await chooseSubject('Buddhism');
    expect(screen.getByRole('dialog')).toHaveTextContent('⚠ Limit reached · 6/6 today');
    await userEvent.click(screen.getByRole('button', { name: /^12A/ }));
    expect(h.onSave).toHaveBeenCalledWith({ id: 'ed', day: 2, period: 5, classIds: [C.c12a], lessons: [{ subjectId: S.buddhism, teacherId: T.ananda }] });
  });

  it('no limit warning below the daily limit', async () => {
    setup();
    await chooseSubject('Buddhism');
    expect(screen.queryByText(/Limit reached/)).not.toBeInTheDocument();
  });

  it('primary teacher: lists plan subjects of their grades', async () => {
    setup({ teacherId: T.wickramasinghe, day: 0 });
    await userEvent.click(screen.getByRole('button', { name: 'Subject' }));
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toContain('Sinhala');
    expect(names).toContain('Buddhism');
    expect(names).not.toContain('Science');
  });

  it('does not offer a Primary-template class when no period overlaps the default row', async () => {
    setup({ teacherId: T.wickramasinghe, day: 0, period: 8 });
    await chooseSubject('Sinhala');
    expect(screen.queryByRole('button', { name: /^1A/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No class takes Sinhala/)).toBeInTheDocument();
  });

  it('assigns a Primary-template class at its matched class period', async () => {
    const h = setup({ teacherId: T.wickramasinghe, day: 0, period: 5 });
    await chooseSubject('Sinhala');
    const option = screen.getByRole('button', { name: /^1A/ });
    expect(option).toHaveTextContent('P6 11:05–11:30');
    await userEvent.click(option);
    expect(h.onSave).toHaveBeenCalledWith({ id: 'ed', day: 0, period: 6, classIds: [C.c1a], lessons: [{ subjectId: S.sinhala, teacherId: T.wickramasinghe }] });
  });

  it('edits an existing lesson: prefilled, reassignable and clearable', async () => {
    const existing = entries6B.find((e) => e.id === 'e-6b-0-1')!;
    const h = setup({ teacherId: T.perera, day: 0, period: 1, editing: existing });
    expect(screen.getByRole('button', { name: 'Subject' })).toHaveTextContent('Mathematics');
    expect(screen.getByRole('button', { name: /^6B/ })).toHaveTextContent('Current');
    await userEvent.click(screen.getByRole('button', { name: /^6A/ }));
    expect(h.onSave).toHaveBeenCalledWith({ id: 'e-6b-0-1', day: 0, period: 1, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear slot' }));
    expect(h.onClear).toHaveBeenCalledWith('e-6b-0-1');
  });

  it('renders nothing when read-only', () => {
    ro.value = true;
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
