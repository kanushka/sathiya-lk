// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, Entry } from '@sathiya/core';
import { C, ctx, entries6B, entry, S, T } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { SlotPicker, type SlotPickerProps } from './SlotPicker';

function setup(props: Partial<SlotPickerProps> = {}, entries: Entry[] = entries6B) {
  const handlers = {
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(true),
    onClear: vi.fn().mockResolvedValue(true),
    onGroup: vi.fn(),
    onCombine: vi.fn(),
  };
  renderWithSchool(
    <SlotPicker open classId={C.c6b} day={2 as DayIndex} period={4} entries={entries} {...handlers} {...props} />,
    { ctx, entries },
  );
  return handlers;
}

async function chooseSubject(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Subject' }));
  await userEvent.click(screen.getByRole('option', { name: new RegExp(`^${name}`) }));
}

describe('SlotPicker', () => {
  it('lists still-needed subjects first with "needs N", then complete ones', async () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Choose a subject' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday · Period 4 · 09:50–10:30')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Subject' }));
    const groups = screen.getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Still needed for 6B', 'Already complete']);
    const needed = within(groups[0]!).getAllByRole('option').map((o) => o.textContent);
    expect(needed).toEqual(['Scienceneeds 2', 'Health & PEneeds 1', 'Practical & Technical Skillsneeds 1']);
    expect(within(groups[1]!).getByRole('option', { name: /Mathematics/ })).toHaveTextContent('6/6');
  });

  it('shows available teachers with staff ID and load, and filters by staff ID', async () => {
    setup();
    await chooseSubject('Science');
    expect(screen.getByRole('dialog', { name: 'Choose a teacher' })).toBeInTheDocument();
    expect(screen.getByText('Available (2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mrs. S. Gunasekara/ })).toHaveTextContent('SCC019 · Free · 0/7 periods on Wednesday');
    expect(screen.getByRole('button', { name: /Mrs. N. Perera/ })).toHaveTextContent('SCC024 · Free · 1/7 periods on Wednesday');
    await userEvent.type(screen.getByPlaceholderText('Search name or staff ID…'), 'scc019');
    expect(screen.getByRole('button', { name: /Mrs. S. Gunasekara/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mrs. N. Perera/ })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('Search name or staff ID…'));
    await userEvent.type(screen.getByPlaceholderText('Search name or staff ID…'), 'zzz');
    expect(screen.getByText('No Science teacher matches “zzz”.')).toBeInTheDocument();
  });

  it('assigns a teacher with a one-class draft and closes', async () => {
    const h = setup();
    await chooseSubject('Science');
    await userEvent.click(screen.getByRole('button', { name: /Mrs. S. Gunasekara/ }));
    expect(h.onSave).toHaveBeenCalledWith({ day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.science, teacherId: T.gunasekara }] });
    await waitFor(() => expect(h.onClose).toHaveBeenCalled());
  });

  it('lists a busy teacher under Not available with the reason, not clickable', async () => {
    setup({}, [...entries6B, entry('x', 2, 4, [C.c6a], [[S.science, T.gunasekara]])]);
    await chooseSubject('Science');
    expect(screen.getByText('Not available (1)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gunasekara/ })).not.toBeInTheDocument();
    const item = screen.getByText('Mrs. S. Gunasekara').closest('li')!;
    expect(item).toHaveTextContent('Busy · 6A Science');
  });

  it('shows limit and grade reasons, hiding teachers who never teach the subject', async () => {
    const full = [1, 2, 3, 5, 6, 7, 8].map((p) => entry(`f${p}`, 2, p, [C.c12a], [[S.maths, T.bandara]]));
    setup({}, [...entries6B, ...full]);
    await chooseSubject('Mathematics');
    expect(screen.getByText('Mr. P. Bandara').closest('li')).toHaveTextContent('Limit reached · 7/7 today');
    expect(screen.queryByRole('button', { name: /Bandara/ })).not.toBeInTheDocument();
    expect(screen.getByText('Mr. T. Jayawardena').closest('li')).toHaveTextContent("Doesn't teach Grade 6");
    expect(screen.queryByText('Mr. K. Herath')).not.toBeInTheDocument();
  });

  it('hands a group plan item to the block editor', async () => {
    const h = setup();
    await chooseSubject('Religion');
    expect(h.onGroup).toHaveBeenCalledWith(expect.objectContaining({ kind: 'group', key: 'religion' }));
  });

  it('offers combining with other classes once a subject is chosen', async () => {
    const h = setup();
    await chooseSubject('Science');
    await userEvent.click(screen.getByRole('button', { name: 'Combine with other classes' }));
    expect(h.onCombine).toHaveBeenCalledWith(S.science);
  });

  it('prefills an existing entry and clears the slot', async () => {
    const existing = entries6B.find((e) => e.id === 'e-6b-0-1')!;
    const h = setup({ day: 0, period: 1, editing: existing });
    expect(screen.getByRole('button', { name: 'Subject' })).toHaveTextContent('Mathematics');
    expect(screen.getByRole('button', { name: /Mrs. N. Perera/ })).toHaveTextContent('Current');
    await userEvent.click(screen.getByRole('button', { name: /Mr. P. Bandara/ }));
    expect(h.onSave).toHaveBeenCalledWith({ id: 'e-6b-0-1', day: 0, period: 1, classIds: [C.c6b], lessons: [{ subjectId: S.maths, teacherId: T.bandara }] });
    await userEvent.click(screen.getByRole('button', { name: 'Clear slot' }));
    expect(h.onClear).toHaveBeenCalledWith('e-6b-0-1');
  });

  it('renders nothing for a slot outside the class template', () => {
    setup({ classId: C.c6c, day: 4, period: 8 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
