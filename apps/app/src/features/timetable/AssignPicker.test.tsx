// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { singleSpec, type Entry } from '@sathiya/core';
import { C, ctx, entries6B, entry, S, T } from '@sathiya/core/fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia } from '../../test/matchMedia';

let restoreMedia = () => {};
afterEach(() => {
  restoreMedia();
  restoreMedia = () => {};
});
import { renderWithSchool } from '../../test/renderWithSchool';
import { AssignPicker, type AssignPickerProps } from './AssignPicker';

const roomy = entries6B.filter((e) => e.id !== 'e-religion-3-6');

function setup(props: Partial<AssignPickerProps> = {}, entries: Entry[] = entries6B) {
  const handlers = {
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(true),
    onPin: vi.fn(),
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
  it('keeps focus in the sheet when Enter moves to the teacher step on phones', async () => {
    restoreMedia = installMatchMedia(375);
    setup();
    await userEvent.click(subjectSearch());
    await userEvent.keyboard('sinh{Enter}');
    expect(screen.getByRole('dialog', { name: 'Choose a teacher' })).toHaveFocus();
  });

  it('does not focus the search on phones, so the keyboard stays down', async () => {
    restoreMedia = installMatchMedia(375);
    setup();
    await waitFor(() => expect(dialog()).toHaveFocus());
    await pickSubject('Sinhala');
    expect(teacherSearch()).not.toHaveFocus();
  });

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
    await waitFor(() => expect(h.onPin).toHaveBeenCalledWith(singleSpec(C.c6b, S.sinhala, T.rSilva)));
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
    expect(h.onPin).toHaveBeenCalledWith(singleSpec(C.c6b, S.sinhala, T.rSilva));
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

  it('searching selects the top match, so the outline, the check and Enter all agree', async () => {
    const h = setup();
    await pickSubject('Sinhala');
    await userEvent.type(teacherSearch(), 'scc016');
    const ranasinghe = teacherRow(/Mrs\. J\. Ranasinghe/);
    expect(ranasinghe).toHaveAttribute('aria-selected', 'true');
    expect(teacherSearch()).toHaveAttribute('aria-activedescendant', ranasinghe.id);
    expect(within(dialog()).queryByRole('option', { name: /Mr\. R\. Silva/ })).not.toBeInTheDocument();
    await userEvent.type(teacherSearch(), '{Enter}');
    expect(h.onSave).toHaveBeenCalledWith(expect.objectContaining({ lessons: [{ subjectId: S.sinhala, teacherId: T.ranasinghe }] }));
  });

  it('keeps the selected teacher while it still matches the search', async () => {
    setup();
    await pickSubject('Sinhala');
    await userEvent.type(teacherSearch(), 's');
    const silva = teacherRow(/Mr\. R\. Silva/);
    expect(silva).toHaveAttribute('aria-selected', 'true');
    expect(teacherSearch()).toHaveAttribute('aria-activedescendant', silva.id);
  });

  it('ignores Enter while an IME is composing', async () => {
    const h = setup();
    fireEvent.keyDown(subjectSearch(), { key: 'Enter', isComposing: true });
    expect(screen.getByRole('dialog', { name: 'Choose a subject' })).toBeInTheDocument();
    await pickSubject('Sinhala');
    fireEvent.keyDown(teacherSearch(), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(teacherSearch(), { key: 'Enter', keyCode: 229 });
    expect(h.onSave).not.toHaveBeenCalled();
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

  describe('group subjects', () => {
    const noReligion = entries6B.filter((e) => e.groupKey !== 'religion');
    const religionSpec = (classIds: string[]) => ({
      classIds,
      lessons: [
        { subjectId: S.buddhism, teacherId: T.ananda },
        { subjectId: S.catholicism, teacherId: T.mSilva },
        { subjectId: S.islam, teacherId: T.rizan },
      ],
      groupKey: 'religion',
    });

    it('lists a group with its tag and option count and opens the group step', async () => {
      setup();
      expect(within(dialog()).getByRole('option', { name: /^Religion/ })).toHaveTextContent('Group lesson · 3 options');
      await pickSubject('Religion');
      expect(screen.getByRole('dialog', { name: 'Set teachers for Religion' })).toBeInTheDocument();
      expect(screen.getByText('Wednesday · Period 4 · 09:50–10:30')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Back to subjects' }));
      expect(screen.getByRole('dialog', { name: 'Choose a subject' })).toBeInTheDocument();
    });

    it('Assign saves one group entry at the slot, then starts pin mode and closes', async () => {
      const h = setup({}, roomy);
      await pickSubject('Religion');
      await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
      expect(h.onSave).toHaveBeenCalledWith({ day: 2, period: 4, ...religionSpec([C.c6b, C.c6a]) });
      await waitFor(() => expect(h.onPin).toHaveBeenCalledWith(religionSpec([C.c6b, C.c6a])));
      expect(h.onClose).toHaveBeenCalled();
    });

    it('stays open when the group save fails', async () => {
      const h = setup();
      h.onSave.mockResolvedValue(false);
      await pickSubject('Religion');
      await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
      await waitFor(() => expect(h.onSave).toHaveBeenCalled());
      expect(h.onPin).not.toHaveBeenCalled();
      expect(h.onClose).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Assign' })).toBeEnabled());
    });

    it('pins other slots without saving when the slot is busy', async () => {
      const h = setup({}, [...roomy, entry('x', 2, 4, [C.c12a], [[S.buddhism, T.ananda]])]);
      await pickSubject('Religion');
      expect(screen.getByText(/Ven\. Ananda Thero · Teaching 12A · Buddhism on Wed P4/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Pin other slots' }));
      expect(h.onSave).not.toHaveBeenCalled();
      expect(h.onPin).toHaveBeenCalledWith(religionSpec([C.c6b, C.c6a]));
      expect(h.onClose).toHaveBeenCalled();
    });

    it('whole week: lists groups and starts pinning without saving', async () => {
      const h = setup({ slot: null }, roomy);
      expect(screen.getByText('Needed first · 11 subjects')).toBeInTheDocument();
      await pickSubject('Religion');
      expect(screen.getByRole('dialog', { name: 'Set teachers for Religion' })).toHaveTextContent('Whole week');
      await userEvent.click(screen.getByRole('button', { name: 'Start pinning' }));
      expect(h.onSave).not.toHaveBeenCalled();
      expect(h.onPin).toHaveBeenCalledWith(religionSpec([C.c6b, C.c6a]));
      expect(h.onClose).toHaveBeenCalled();
    });

    it('Escape in an option search closes the option, not the popup', async () => {
      const h = setup();
      await pickSubject('Religion');
      const row = screen.getByRole('button', { name: /^Buddhism teacher:/ });
      await userEvent.click(row);
      await userEvent.type(screen.getByRole('combobox', { name: 'Search Buddhism teachers' }), '{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(h.onClose).not.toHaveBeenCalled();
      await waitFor(() => expect(row).toHaveFocus());
    });

    it('opens straight at the group step with groupKey', async () => {
      setup({ slot: null, groupKey: 'religion' }, noReligion);
      expect(screen.getByRole('dialog', { name: 'Set teachers for Religion' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start pinning' })).toBeDisabled();
    });
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
      expect(h.onPin).toHaveBeenCalledWith(singleSpec(C.c6b, S.sinhala, T.rSilva));
      expect(h.onSave).not.toHaveBeenCalled();
      expect(h.onClose).toHaveBeenCalled();
    });

    it('shows group subjects after going back', async () => {
      setup({ slot: null, subjectId: S.sinhala });
      await userEvent.click(screen.getByRole('button', { name: 'Back to subjects' }));
      expect(within(dialog()).getByRole('option', { name: /^Religion/ })).toBeInTheDocument();
      expect(screen.getByText('Needed first · 11 subjects')).toBeInTheDocument();
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

    it('ArrowDown selects the second teacher and Enter assigns it', async () => {
      const h = setup();
      await pickSubject('Sinhala');
      const input = teacherSearch();
      const list = screen.getByRole('listbox', { name: 'Teachers' });
      expect(input).toHaveAttribute('aria-controls', list.id);
      const options = within(list).getAllByRole('option');
      expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
      await userEvent.type(input, '{ArrowDown}');
      expect(teacherRow(/Mrs\. J\. Ranasinghe/)).toHaveAttribute('aria-selected', 'true');
      expect(teacherRow(/Mr\. R\. Silva/)).toHaveAttribute('aria-selected', 'false');
      expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id);
      await userEvent.type(input, '{Enter}');
      expect(h.onSave).toHaveBeenCalledWith(expect.objectContaining({ lessons: [{ subjectId: S.sinhala, teacherId: T.ranasinghe }] }));
    });
  });
});
