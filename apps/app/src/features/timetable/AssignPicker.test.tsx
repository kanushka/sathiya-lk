// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Entry } from '@sathiya/core';
import { C, ctx, entries6B, entry, S, T } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { AssignPicker, type AssignPickerProps } from './AssignPicker';

function setup(props: Partial<AssignPickerProps> = {}, entries: Entry[] = entries6B) {
  const handlers = {
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(true),
    onPin: vi.fn(),
    onGroup: vi.fn(),
    onCombine: vi.fn(),
  };
  renderWithSchool(<AssignPicker classId={C.c6b} slot={{ day: 2, period: 4 }} entries={entries} {...handlers} {...props} />, { ctx, entries });
  return handlers;
}

const dialog = () => screen.getByRole('dialog');
const subjectSearch = () => screen.getByRole('combobox', { name: 'Search subjects' });
const teacherSearch = () => screen.getByRole('combobox', { name: 'Search teachers' });
const teacherRow = (name: RegExp) => within(dialog()).getByRole('option', { name });

async function pickSubject(name: string) {
  await userEvent.click(within(dialog()).getByRole('option', { name: new RegExp(`^${name}`) }));
}

describe('AssignPicker', () => {
  it('starts on a searchable subject list with needed subjects first, focused', async () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Choose a subject' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday · Period 4 · 09:50–10:30')).toBeInTheDocument();
    await waitFor(() => expect(subjectSearch()).toHaveFocus());
    expect(screen.getByText('Needed first · 11 subjects')).toBeInTheDocument();
    const names = within(screen.getByRole('listbox', { name: 'Subjects' }))
      .getAllByRole('option')
      .map((b) => b.textContent);
    expect(names.slice(0, 3)).toEqual(['ScienceMrs. S. Gunasekaraneeds 2', 'Health & PEMr. S. Kumaraneeds 1', 'Practical & Technical SkillsMr. D. Fonsekaneeds 1']);
    expect(names[3]).toContain('Mathematics');
    expect(names[3]).toContain('6/6');
  });

  it('filters subjects, says when nothing matches, and Enter picks the top match', async () => {
    setup();
    await userEvent.type(subjectSearch(), 'zzz');
    expect(screen.getByText('No subject matches “zzz”.')).toBeInTheDocument();
    await userEvent.clear(subjectSearch());
    await userEvent.type(subjectSearch(), 'sinh{Enter}');
    expect(screen.getByRole('dialog', { name: 'Choose a teacher' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to subjects' })).toHaveTextContent('Sinhala');
  });

  it('preselects the preferred free teacher on top; Assign saves, enters pin mode and closes', async () => {
    const h = setup();
    await pickSubject('Sinhala');
    const rows = within(screen.getByRole('listbox', { name: 'Teachers' })).getAllByRole('option');
    expect(rows[0]).toHaveAccessibleName(/Mr\. R\. Silva/);
    expect(rows[0]).toHaveTextContent('★ Teaches 6B Sinhala');
    expect(rows[0]).toHaveTextContent('SCC011 · Free · 2/7 periods on Wednesday');
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    expect(teacherRow(/Mrs\. J\. Ranasinghe/)).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(h.onSave).toHaveBeenCalledWith({ day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.sinhala, teacherId: T.rSilva }] });
    await waitFor(() => expect(h.onPin).toHaveBeenCalledWith({ subjectId: S.sinhala, teacherId: T.rSilva }));
    expect(h.onClose).toHaveBeenCalled();
  });

  it('lets another teacher be chosen before Assign', async () => {
    const h = setup();
    await pickSubject('Sinhala');
    await userEvent.click(teacherRow(/Mrs\. J\. Ranasinghe/));
    expect(teacherRow(/Mrs\. J\. Ranasinghe/)).toHaveAttribute('aria-selected', 'true');
    expect(teacherRow(/Mr\. R\. Silva/)).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(h.onSave).toHaveBeenCalledWith(expect.objectContaining({ lessons: [{ subjectId: S.sinhala, teacherId: T.ranasinghe }] }));
  });

  it('keeps Assign disabled until a teacher is chosen when there is no preferred teacher', async () => {
    setup({}, entries6B.filter((e) => e.lessons[0]?.subjectId !== S.science));
    await pickSubject('Science');
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
    await userEvent.click(teacherRow(/Mrs\. S\. Gunasekara/));
    expect(screen.getByRole('button', { name: 'Assign' })).toBeEnabled();
  });

  it('greys a busy teacher with the detailed reason and offers using them for other slots', async () => {
    const h = setup({}, [...entries6B, entry('x', 2, 4, [C.c6a], [[S.sinhala, T.rSilva]])]);
    await pickSubject('Sinhala');
    expect(within(dialog()).queryByRole('option', { name: /^Mr\. R\. Silva/ })).not.toBeInTheDocument();
    const silva = screen.getByText('Mr. R. Silva').closest('li')!;
    expect(silva.compareDocumentPosition(screen.getByRole('listbox', { name: 'Teachers' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(silva).toHaveTextContent('Mr. R. Silva');
    expect(silva).toHaveTextContent('★ Teaches 6B Sinhala');
    expect(silva).toHaveTextContent('SCC011 · Teaching 6A · Sinhala');
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
    await userEvent.click(within(silva).getByRole('button', { name: 'Use for other slots' }));
    expect(h.onPin).toHaveBeenCalledWith({ subjectId: S.sinhala, teacherId: T.rSilva });
    expect(h.onSave).not.toHaveBeenCalled();
  });

  it('lets a limit-reached teacher be chosen with a warning', async () => {
    const full = [1, 2, 3, 5, 6, 7, 8].map((p) => entry(`f${p}`, 2, p, [C.c12a], [[S.maths, T.bandara]]));
    setup({}, [...entries6B, ...full]);
    await pickSubject('Mathematics');
    const bandara = teacherRow(/Mr\. P\. Bandara/);
    expect(bandara).toHaveTextContent('⚠ Limit reached · 7/7 today');
    await userEvent.click(bandara);
    expect(bandara).toHaveAttribute('aria-selected', 'true');
  });

  it('lists subject teachers outside the grade with the reason, hiding non-subject teachers', async () => {
    setup();
    await pickSubject('Mathematics');
    expect(within(dialog()).queryByRole('option', { name: /Jayawardena/ })).not.toBeInTheDocument();
    expect(screen.getByText('Mr. T. Jayawardena').closest('li')).toHaveTextContent("Doesn't teach Grade 6");
    expect(screen.queryByText('Mr. K. Herath')).not.toBeInTheDocument();
  });

  it('searches teachers by staff ID; Enter picks the top match, Enter again assigns', async () => {
    const h = setup();
    await pickSubject('Sinhala');
    await userEvent.type(teacherSearch(), 'scc016{Enter}');
    expect(teacherRow(/Mrs\. J\. Ranasinghe/)).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog()).queryByRole('button', { name: /Mr\. R\. Silva/ })).not.toBeInTheDocument();
    await userEvent.type(teacherSearch(), '{Enter}');
    expect(h.onSave).toHaveBeenCalledWith(expect.objectContaining({ lessons: [{ subjectId: S.sinhala, teacherId: T.ranasinghe }] }));
    await userEvent.clear(teacherSearch());
  });

  it('says when no teacher matches', async () => {
    setup();
    await pickSubject('Science');
    await userEvent.type(teacherSearch(), 'zzz');
    expect(screen.getByText('No Science teacher matches “zzz”.')).toBeInTheDocument();
  });

  it('goes back to subjects with a cleared search', async () => {
    setup();
    await userEvent.type(subjectSearch(), 'sinh');
    await pickSubject('Sinhala');
    await userEvent.click(screen.getByRole('button', { name: 'Back to subjects' }));
    expect(screen.getByRole('dialog', { name: 'Choose a subject' })).toBeInTheDocument();
    expect(subjectSearch()).toHaveValue('');
    await waitFor(() => expect(subjectSearch()).toHaveFocus());
  });

  it('hands a group subject to the block editor', async () => {
    const h = setup();
    await pickSubject('Religion');
    expect(h.onGroup).toHaveBeenCalledWith(expect.objectContaining({ kind: 'group', key: 'religion' }));
  });

  it('offers combining with other classes once a subject is chosen', async () => {
    const h = setup();
    await pickSubject('Science');
    await userEvent.click(screen.getByRole('button', { name: 'Combine with other classes' }));
    expect(h.onCombine).toHaveBeenCalledWith(S.science);
  });

  it('stays open and does not enter pin mode when the save fails', async () => {
    const h = setup();
    h.onSave.mockResolvedValue(false);
    await pickSubject('Sinhala');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(h.onSave).toHaveBeenCalled());
    expect(h.onPin).not.toHaveBeenCalled();
    expect(h.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Assign' })).toBeEnabled();
  });

  describe('whole week (from the lesson list)', () => {
    it('opens on the teacher step with free periods this week and starts pin mode without saving', async () => {
      const h = setup({ slot: null, subjectId: S.sinhala });
      expect(screen.getByRole('dialog', { name: 'Choose a teacher' })).toBeInTheDocument();
      expect(screen.getByText('Whole week')).toBeInTheDocument();
      const silva = teacherRow(/Mr\. R\. Silva/);
      expect(silva).toHaveTextContent('SCC011 · 4 free periods for 6B this week');
      expect(silva).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('button', { name: 'Combine with other classes' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Start pinning' }));
      expect(h.onPin).toHaveBeenCalledWith({ subjectId: S.sinhala, teacherId: T.rSilva });
      expect(h.onSave).not.toHaveBeenCalled();
      expect(h.onClose).toHaveBeenCalled();
    });

    it('hides group subjects after going back', async () => {
      setup({ slot: null, subjectId: S.sinhala });
      await userEvent.click(screen.getByRole('button', { name: 'Back to subjects' }));
      expect(within(dialog()).queryByRole('option', { name: /^Religion/ })).not.toBeInTheDocument();
      expect(screen.getByText('Needed first · 9 subjects')).toBeInTheDocument();
    });
  });

  describe('combobox keyboard pattern', () => {
    it('wires the subject search to its listbox and moves the active option with arrows', async () => {
      setup();
      const input = subjectSearch();
      const list = screen.getByRole('listbox', { name: 'Subjects' });
      expect(input).toHaveAttribute('aria-controls', list.id);
      expect(input).toHaveAttribute('aria-expanded', 'true');
      const options = within(list).getAllByRole('option');
      expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
      await userEvent.type(input, '{ArrowDown}');
      expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id);
      await userEvent.type(input, '{ArrowUp}{ArrowUp}');
      expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
      await userEvent.type(input, '{ArrowDown}{Enter}');
      expect(screen.getByRole('button', { name: 'Back to subjects' })).toHaveTextContent('Health & PE');
    });

    it('ArrowDown then Enter picks the second teacher, Enter again assigns', async () => {
      const h = setup();
      await pickSubject('Sinhala');
      const input = teacherSearch();
      const list = screen.getByRole('listbox', { name: 'Teachers' });
      expect(input).toHaveAttribute('aria-controls', list.id);
      const options = within(list).getAllByRole('option');
      expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
      await userEvent.type(input, '{ArrowDown}{Enter}');
      expect(teacherRow(/Mrs\. J\. Ranasinghe/)).toHaveAttribute('aria-selected', 'true');
      expect(teacherRow(/Mr\. R\. Silva/)).toHaveAttribute('aria-selected', 'false');
      await userEvent.type(input, '{Enter}');
      expect(h.onSave).toHaveBeenCalledWith(expect.objectContaining({ lessons: [{ subjectId: S.sinhala, teacherId: T.ranasinghe }] }));
    });
  });
});
