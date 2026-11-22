// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { Field } from './Field';
import { Modal } from './Modal';
import { MultiSelect, type MultiSelectProps } from './MultiSelect';
import type { SelectOption } from './Select';

const grades: SelectOption[] = [
  { value: 'g6', label: 'Grade 6' },
  { value: 'g7', label: 'Grade 7' },
  { value: 'g8', label: 'Grade 8', disabled: true },
  { value: 'g9', label: 'Grade 9' },
  { value: 'g10', label: 'Grade 10' },
  { value: 'g11', label: 'Grade 11' },
];

const many: SelectOption[] = ['Art', 'Biology', 'Chemistry', 'Drama', 'English', 'French', 'Geography', 'History', 'ICT'].map(
  (label) => ({ value: label.toLowerCase(), label }),
);

type Props = Partial<MultiSelectProps> & { onChange?: (v: string[]) => void };

function Controlled(props: Props) {
  const [value, setValue] = useState<string[]>(props.value ?? []);
  return (
    <MultiSelect
      options={grades}
      aria-label="Grades"
      {...props}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
    />
  );
}

function setup(props: Props = {}) {
  const onChange = props.onChange ?? vi.fn();
  const utils = renderWithI18n(<Controlled {...props} onChange={onChange} />);
  return {
    ...utils,
    onChange,
    user: userEvent.setup(),
    trigger: screen.getByRole('combobox', { name: new RegExp(`^${props['aria-label'] ?? 'Grades'}`) }),
  };
}

const visible = { ignore: '.sr-only, script, style' };
const activeOption = () => screen.getAllByRole('option').find((o) => o.dataset.active === 'true');

describe('MultiSelect', () => {
  it('shows the placeholder when empty and opens a multiselectable listbox on click', async () => {
    const { user, trigger } = setup();
    expect(trigger).toHaveTextContent('Choose…');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    const listbox = screen.getByRole('listbox', { name: 'Grades' });
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getByText('0 of 6 selected')).toBeInTheDocument();
  });

  it('wrap lets every chip show and flow onto more lines', () => {
    setup({ value: ['g11', 'g6', 'g10', 'g9'], maxChips: Infinity, wrap: true });
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(4);
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    const box = screen.getByRole('combobox', { name: /^Grades/ }).parentElement!;
    expect(box).toHaveClass('flex-wrap');
    expect(box).not.toHaveClass('overflow-hidden');
  });

  it('uses getRemoveLabel for chip remove buttons', () => {
    setup({ value: ['g6'], getRemoveLabel: (o) => `Drop ${o.label} here` });
    expect(screen.getByRole('button', { name: 'Drop Grade 6 here' })).toBeInTheDocument();
  });

  it('shows chips for the first maxChips values in option order and a +N chip for the rest', () => {
    setup({ value: ['g11', 'g6', 'g10', 'g9'], maxChips: 2 });
    const chips = screen.getAllByRole('button', { name: /^Remove / });
    expect(chips.map((b) => b.getAttribute('aria-label'))).toEqual(['Remove Grade 6', 'Remove Grade 9']);
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Grades 4 of 6 selected' })).not.toHaveTextContent('Choose…');
  });

  it('removes a value with its chip button without opening the menu', async () => {
    const { user, onChange } = setup({ value: ['g6', 'g7'] });
    const remove = screen.getByRole('button', { name: 'Remove Grade 6' });
    expect(remove).toHaveAttribute('tabindex', '-1');
    await user.click(remove);
    expect(onChange).toHaveBeenLastCalledWith(['g7']);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Grade 6' })).not.toBeInTheDocument();
  });

  it('removes the last selected value with Backspace while closed', async () => {
    const { user, trigger, onChange } = setup({ value: ['g9', 'g6'] });
    trigger.focus();
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(['g9']);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('exposes the selection in the combobox name and updates it after Backspace', async () => {
    const { user, trigger } = setup({ value: ['g9', 'g6'] });
    expect(trigger).toHaveAccessibleName('Grades Grade 6, Grade 9');
    trigger.focus();
    await user.keyboard('{Backspace}');
    expect(trigger).toHaveAccessibleName('Grades Grade 9');
    await user.keyboard('{Backspace}');
    expect(trigger).toHaveAccessibleName('Grades');
  });

  it('keeps the selection in the name with a Field label or aria-labelledby', () => {
    const { unmount } = renderWithI18n(
      <Field label="Grades">
        <MultiSelect options={grades} value={['g7']} onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole('combobox')).toHaveAccessibleName('Grades Grade 7');
    unmount();
    renderWithI18n(
      <>
        <span id="ext">Classes</span>
        <MultiSelect options={grades} value={['g6', 'g7']} onChange={() => {}} aria-labelledby="ext" />
      </>,
    );
    expect(screen.getByRole('combobox')).toHaveAccessibleName('Classes Grade 6, Grade 7');
  });

  it('ignores values missing from options on Backspace', async () => {
    const { user, trigger, onChange } = setup({ value: ['g6', 'gone'] });
    trigger.focus();
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(['gone']);
  });

  it('opens when clicking the wrapper outside the combobox', async () => {
    const { user, trigger } = setup({ value: ['g6'] });
    const chipLabel = within(trigger.parentElement!).getByText('Grade 6', visible);
    await user.click(chipLabel);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(chipLabel);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('toggles options by click and keeps the menu open', async () => {
    const { user, trigger, onChange } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Grade 7' }));
    expect(onChange).toHaveBeenLastCalledWith(['g7']);
    expect(screen.getByRole('option', { name: 'Grade 7' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('1 of 6 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Grade 7' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Grade 8' }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('toggles the active option with Space and Enter and keeps the menu open', async () => {
    const { user, trigger, onChange } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Grade 6');
    await user.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(['g6']);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Grade 9');
    expect(trigger).toHaveAttribute('aria-activedescendant', activeOption()!.id);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['g6', 'g9']);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['g6']);
    expect(trigger).toHaveFocus();
  });

  it('ignores Enter while an IME is composing', async () => {
    const { user, trigger, onChange } = setup();
    await user.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter', isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects all enabled options and clears all', async () => {
    const { user, trigger, onChange } = setup({ value: ['g7'] });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onChange).toHaveBeenLastCalledWith(['g7', 'g6', 'g9', 'g10', 'g11']);
    expect(screen.getByText('5 of 6 selected', visible)).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('selects all with Ctrl+A and Meta+A', async () => {
    const { user, trigger, onChange } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}{Control>}a{/Control}');
    expect(onChange).toHaveBeenLastCalledWith(['g6', 'g7', 'g9', 'g10', 'g11']);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.keyboard('{Meta>}a{/Meta}');
    expect(onChange).toHaveBeenLastCalledWith(['g6', 'g7', 'g9', 'g10', 'g11']);
  });

  it('hides the select all button when selectAll is false', async () => {
    const { user, trigger } = setup({ selectAll: false });
    await user.click(trigger);
    expect(screen.queryByRole('button', { name: 'Select all' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('searches above 8 options; select all adds only the filtered options', async () => {
    const { user, trigger, onChange } = setup({ options: many, 'aria-label': 'Subjects' });
    await user.click(trigger);
    const search = screen.getByRole('combobox', { name: 'Search' });
    expect(search).toHaveFocus();
    await user.type(search, 'IST');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Chemistry', 'History']);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['history']);
    expect(search).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onChange).toHaveBeenLastCalledWith(['history', 'chemistry']);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('closes on Tab and on outside mousedown', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes only the menu on Escape inside a Modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithI18n(
      <Modal open title="Pick" onClose={onClose}>
        <Controlled options={many} aria-label="Subjects" />
      </Modal>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Subjects' });
    await user.click(trigger);
    expect(screen.getByRole('dialog').contains(screen.getByRole('listbox'))).toBe(false);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is disabled: no menu, no chip removal', async () => {
    const { user, trigger, onChange } = setup({ value: ['g6'], disabled: true });
    expect(trigger).toBeDisabled();
    await user.click(screen.getByText('Grade 6', visible));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Grade 6' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is named by a Field label, marked invalid, and labels its listbox from the label', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <Field label="Grades" error="Pick some">
        <MultiSelect options={grades} value={[]} onChange={() => {}} required />
      </Field>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Grades' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-required', 'true');
    expect(trigger).toHaveAccessibleDescription('Pick some');
    await user.click(trigger);
    const listbox = screen.getByRole('listbox', { name: 'Grades' });
    expect(document.getElementById(listbox.getAttribute('aria-labelledby') ?? '')?.tagName).toBe('LABEL');
  });

  it('renders one hidden input per value when name is set', () => {
    const { container } = renderWithI18n(
      <MultiSelect options={grades} value={['g6', 'g9']} onChange={() => {}} name="grades" aria-label="Grades" />,
    );
    const hidden = [...container.querySelectorAll('input[type="hidden"]')];
    expect(hidden.map((h) => [h.getAttribute('name'), (h as HTMLInputElement).value])).toEqual([
      ['grades', 'g6'],
      ['grades', 'g9'],
    ]);
  });

  it('renders option groups', async () => {
    const { user, trigger } = setup({
      options: [
        { value: 'a', label: 'A1', group: 'Primary' },
        { value: 'b', label: 'B1', group: 'Secondary' },
        { value: 'c', label: 'A2', group: 'Primary' },
      ],
    });
    await user.click(trigger);
    const groups = within(screen.getByRole('listbox')).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Primary', 'Secondary']);
  });
});
