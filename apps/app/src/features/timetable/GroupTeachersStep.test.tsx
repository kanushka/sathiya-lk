// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Entry, PinSpec, SchoolContext, Teacher } from '@sathiya/core';
import { C, ctx, entries, entries6B, entry, G, S, T } from '@sathiya/core/fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { GroupTeachersStep, type GroupTeachersStepProps } from './GroupTeachersStep';
import type { GroupItem } from './pickerData';

const religion = ctx.grades.find((g) => g.id === G.g6)!.plan.find((p): p is GroupItem => p.kind === 'group' && p.key === 'religion')!;
const extra: Teacher = { id: 't-extra', staffId: 'SCC099', title: 'Mr', name: 'B. Perera', isPrimary: false, subjectIds: [S.buddhism, S.catholicism], grades: [6], maxPerDay: 7 };
const ctx2: SchoolContext = { ...ctx, teachers: [...ctx.teachers, extra] };
const noReligion = entries6B.filter((e) => e.groupKey !== 'religion');

const spec = (classIds: string[], teachers: [string, string, string] = [T.ananda, T.mSilva, T.rizan]): PinSpec => ({
  classIds,
  lessons: [
    { subjectId: S.buddhism, teacherId: teachers[0] },
    { subjectId: S.catholicism, teacherId: teachers[1] },
    { subjectId: S.islam, teacherId: teachers[2] },
  ],
  groupKey: 'religion',
});

function setup(props: Partial<GroupTeachersStepProps> = {}, list: Entry[] = entries6B, school: SchoolContext = ctx) {
  const onConfirm = vi.fn();
  const onBack = vi.fn();
  renderWithSchool(<GroupTeachersStep classId={C.c6b} item={religion} slot={{ day: 2, period: 4 }} entries={list} onBack={onBack} onConfirm={onConfirm} {...props} />, {
    ctx: school,
    entries: list,
  });
  return { onConfirm, onBack };
}

const optionRow = (subject: string) => screen.getByRole('button', { name: new RegExp(`^${subject} teacher:`) });

describe('GroupTeachersStep', () => {
  it('shows the group header with options and need, and goes back', async () => {
    const h = setup();
    const back = screen.getByRole('button', { name: 'Back to subjects' });
    expect(back).toHaveTextContent('Religion');
    expect(back).toHaveTextContent('group · 3 options · 3/3');
    await userEvent.click(back);
    expect(h.onBack).toHaveBeenCalled();
  });

  it('preselects each option’s preferred teacher with a star and a free status for the slot', () => {
    setup();
    expect(screen.getByText('Teacher for each option')).toBeInTheDocument();
    const bud = optionRow('Buddhism');
    expect(bud).toHaveAttribute('aria-expanded', 'false');
    expect(bud).toHaveTextContent('Ven. Ananda Thero');
    expect(bud).toHaveTextContent('★ Teaches 6B Buddhism');
    expect(bud).toHaveTextContent('✓ free');
    expect(optionRow('Catholicism')).toHaveTextContent('Rev. Fr. M. Silva');
    expect(optionRow('Islam')).toHaveTextContent('Mr. A. Rizan');
  });

  it('starts with the classes of the latest group lesson and assigns when the slot is free for all', async () => {
    const h = setup();
    expect(screen.getByText('6B, this class')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /6A/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('All 3 teachers and 6A+6B are free on Wed P4.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(h.onConfirm).toHaveBeenCalledWith(spec([C.c6b, C.c6a]), true);
  });

  it('names the class beside its period when opened from a teacher row', () => {
    setup({ classPeriods: true });
    expect(screen.getByText('All 3 teachers and 6A+6B are free on Wed 6B P4.')).toBeInTheDocument();
  });

  it('toggles a mate class off and on', async () => {
    const h = setup();
    await userEvent.click(screen.getByRole('button', { name: /6A/ }));
    expect(screen.getByRole('button', { name: /6A/ })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(h.onConfirm).toHaveBeenCalledWith(spec([C.c6b]), true);
  });

  it('uses initialClassIds over the latest lesson', () => {
    setup({ initialClassIds: [C.c6b] });
    expect(screen.getByRole('button', { name: /6A/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('flags a mate busy at the slot', () => {
    setup({}, entries);
    expect(screen.getByRole('button', { name: /6A/ })).toHaveTextContent('✓ 6A · busy Wed P4');
  });

  it('blocks Assign until every option has a teacher', async () => {
    setup({}, noReligion);
    expect(screen.getByRole('button', { name: /6A/ })).toHaveAttribute('aria-pressed', 'false');
    expect(optionRow('Buddhism')).toHaveTextContent('Choose a teacher');
    expect(optionRow('Buddhism')).toHaveTextContent('Needed');
    expect(screen.getByText('Choose a teacher for Buddhism, Catholicism, Islam.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  });

  it('opens an option as a searchable listbox, preferred first, and picking closes it', async () => {
    setup({}, entries6B, ctx2);
    await userEvent.click(optionRow('Buddhism'));
    expect(optionRow('Buddhism')).toHaveAttribute('aria-expanded', 'true');
    const input = screen.getByRole('combobox', { name: 'Search Buddhism teachers' });
    await waitFor(() => expect(input).toHaveFocus());
    const list = screen.getByRole('listbox', { name: 'Buddhism teachers' });
    expect(input).toHaveAttribute('aria-controls', list.id);
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Ven. Ananda Thero');
    expect(options[0]).toHaveTextContent('SCC042 · free Wed P4 · 1/6');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveTextContent('Mr. B. Perera');
    await userEvent.click(options[1]!);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(optionRow('Buddhism')).toHaveTextContent('Mr. B. Perera');
    expect(optionRow('Buddhism')).not.toHaveTextContent('★');
  });

  it('moves with arrows, picks with Enter and ignores IME composing', async () => {
    setup({}, entries6B, ctx2);
    await userEvent.click(optionRow('Buddhism'));
    const input = screen.getByRole('combobox', { name: 'Search Buddhism teachers' });
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
    await userEvent.type(input, '{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.type(input, '{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(optionRow('Buddhism')).toHaveTextContent('Mr. B. Perera');
  });

  it('filters teachers by name or staff ID', async () => {
    setup({}, entries6B, ctx2);
    await userEvent.click(optionRow('Buddhism'));
    await userEvent.type(screen.getByRole('combobox', { name: 'Search Buddhism teachers' }), 'scc099');
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Mr. B. Perera');
  });

  it('blocks the same teacher on two options', async () => {
    setup({}, entries6B, ctx2);
    await userEvent.click(optionRow('Buddhism'));
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /B\. Perera/ }));
    await userEvent.click(optionRow('Catholicism'));
    await userEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /B\. Perera/ }));
    expect(optionRow('Buddhism')).toHaveTextContent('Same teacher twice');
    expect(screen.getByText('One teacher can’t take two options in the same period.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  });

  it('names the blockers and offers pinning other slots when the slot is busy', async () => {
    const h = setup({}, [...entries6B, entry('x', 2, 4, [C.c12a], [[S.buddhism, T.ananda]])]);
    expect(optionRow('Buddhism')).toHaveTextContent('⚠ busy');
    expect(screen.getByText('Ven. Ananda Thero · Teaching 12A · Buddhism on Wed P4. Pin the other free slots instead.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pin other slots' }));
    expect(h.onConfirm).toHaveBeenCalledWith(spec([C.c6b, C.c6a]), false);
  });

  it('gives a generic note when the class already has a lesson at the slot', async () => {
    const h = setup({ slot: { day: 0, period: 1 } });
    expect(screen.getByText('Mon P1 isn’t free for 6A+6B. Pin the other free slots instead.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pin other slots' }));
    expect(h.onConfirm).toHaveBeenCalledWith(spec([C.c6b, C.c6a]), false);
  });

  it('uses a custom back label', async () => {
    const h = setup({ back: { text: '‹ Back to classes', label: 'Back to classes' } });
    const back = screen.getByRole('button', { name: 'Back to classes' });
    expect(back).toHaveTextContent('‹ Back to classes');
    await userEvent.click(back);
    expect(h.onBack).toHaveBeenCalled();
  });

  it('shows a busy note on a busy candidate', async () => {
    setup({}, [...entries6B, entry('x', 2, 4, [C.c12a], [[S.buddhism, T.ananda]])], ctx2);
    await userEvent.click(optionRow('Buddhism'));
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: /Ananda/ })).toHaveTextContent('SCC042 · busy Wed P4 · Teaching 12A · Buddhism');
  });

  it('whole week: counts free periods per teacher and starts pinning', async () => {
    const h = setup({ slot: null });
    expect(optionRow('Buddhism')).toHaveTextContent('✓');
    expect(optionRow('Buddhism')).not.toHaveTextContent('free');
    expect(screen.getByText('Pin mode will overlay 3 teachers and 6A+6B.')).toBeInTheDocument();
    await userEvent.click(optionRow('Buddhism'));
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: /Ananda/ })).toHaveTextContent(/SCC042 · \d+ free periods for 6A\+6B this week/);
    await userEvent.click(screen.getByRole('button', { name: 'Start pinning' }));
    expect(h.onConfirm).toHaveBeenCalledWith(spec([C.c6b, C.c6a]), false);
  });

  it('shows a locked option with its teacher and no disclosure', async () => {
    const h = setup({ slot: null, lockedSubjectId: S.islam, lockedTeacherId: T.rizan }, noReligion);
    expect(screen.queryByRole('button', { name: /^Islam teacher:/ })).not.toBeInTheDocument();
    const locked = screen.getByText('This teacher').closest('li')!;
    expect(locked).toHaveTextContent('Islam');
    expect(locked).toHaveTextContent('Mr. A. Rizan');
    await userEvent.click(optionRow('Buddhism'));
    await userEvent.type(screen.getByRole('combobox', { name: 'Search Buddhism teachers' }), '{Enter}');
    await userEvent.click(optionRow('Catholicism'));
    await userEvent.type(screen.getByRole('combobox', { name: 'Search Catholicism teachers' }), '{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Start pinning' }));
    expect(h.onConfirm).toHaveBeenCalledWith(spec([C.c6b]), false);
  });

  it('lets the container place the footer', () => {
    renderWithSchool(
      <GroupTeachersStep classId={C.c6b} item={religion} slot={null} entries={entries6B} onConfirm={vi.fn()}>
        {({ body, footer }) => (
          <>
            <div data-testid="body">{body}</div>
            <div data-testid="footer">{footer}</div>
          </>
        )}
      </GroupTeachersStep>,
      { ctx, entries: entries6B },
    );
    expect(within(screen.getByTestId('footer')).getByRole('button', { name: 'Start pinning' })).toBeInTheDocument();
    expect(within(screen.getByTestId('body')).queryByRole('button', { name: 'Start pinning' })).not.toBeInTheDocument();
    expect(within(screen.getByTestId('body')).getByText('Religion')).toBeInTheDocument();
  });
});
