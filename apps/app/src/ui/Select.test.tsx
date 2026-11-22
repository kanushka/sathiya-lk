// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { Field } from './Field';
import { Modal } from './Modal';
import { Select, type SelectOption, type SelectProps } from './Select';

const fruits: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'blueberry', label: 'Blueberry' },
  { value: 'cherry', label: 'Cherry' },
];

const many: SelectOption[] = ['Art', 'Biology', 'Chemistry', 'Drama', 'English', 'French', 'Geography', 'History', 'ICT', 'Japanese', 'Korean'].map(
  (label) => ({ value: label.toLowerCase(), label }),
);

function Controlled(props: Partial<SelectProps> & { onChange?: (v: string) => void }) {
  const [value, setValue] = useState<string>(props.value ?? '');
  return (
    <Select
      options={fruits}
      aria-label="Fruit"
      {...props}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
    />
  );
}

function setup(props: Partial<SelectProps> & { onChange?: (v: string) => void } = {}) {
  const onChange = props.onChange ?? vi.fn();
  renderWithI18n(<Controlled {...props} onChange={onChange} />);
  return { onChange, user: userEvent.setup(), trigger: screen.getByRole('combobox', { name: /^Fruit/ }) };
}

const activeOption = () => screen.getAllByRole('option').find((o) => o.dataset.active === 'true');

describe('Select', () => {
  it('shows the default placeholder and opens on click', async () => {
    const { user, trigger } = setup();
    expect(trigger).toHaveTextContent('Choose…');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox', { name: 'Fruit' });
    expect(trigger).toHaveAttribute('aria-controls', listbox.id);
    expect(within(listbox).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Apple',
      'Banana',
      'Blueberry',
      'Cherry',
    ]);
    expect(screen.queryByRole('combobox', { name: 'Search' })).not.toBeInTheDocument();
  });

  it('opens on ArrowDown with the selected option active', async () => {
    const { user, trigger } = setup({ value: 'blueberry' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const blueberry = screen.getByRole('option', { name: 'Blueberry' });
    expect(blueberry).toHaveAttribute('aria-selected', 'true');
    expect(activeOption()).toBe(blueberry);
    expect(trigger).toHaveAttribute('aria-activedescendant', blueberry.id);
    expect(trigger).toHaveFocus();
  });

  it('moves with arrows skipping disabled, without wrapping, and supports Home/End', async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Apple');
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Blueberry');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Cherry');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(activeOption()).toHaveTextContent('Apple');
    await user.keyboard('{ArrowUp}');
    expect(activeOption()).toHaveTextContent('Apple');
    await user.keyboard('{End}');
    expect(activeOption()).toHaveTextContent('Cherry');
    await user.keyboard('{Home}');
    expect(activeOption()).toHaveTextContent('Apple');
  });

  it('jumps by typeahead, skipping disabled options and wrapping around', async () => {
    // Testing Library awaits a real 0ms timeout after each user-event call; frozen timers would hang it.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderWithI18n(<Controlled />);
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      screen.getByRole('combobox', { name: 'Fruit' }).focus();
      await user.keyboard('c');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(activeOption()).toHaveTextContent('Cherry');
      await user.keyboard('h');
      expect(activeOption()).toHaveTextContent('Cherry');
      vi.advanceTimersByTime(500);
      await user.keyboard('b');
      expect(activeOption()).toHaveTextContent('Blueberry');
      vi.advanceTimersByTime(500);
      await user.keyboard('a');
      expect(activeOption()).toHaveTextContent('Apple');
    } finally {
      vi.useRealTimers();
    }
  });

  it('picks with Enter and Space and refocuses the trigger', async () => {
    const { user, trigger, onChange } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('blueberry');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent('Blueberry');
    expect(trigger).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown} ');
    expect(onChange).toHaveBeenLastCalledWith('cherry');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not call onChange when picking the current value', async () => {
    const { user, trigger, onChange } = setup({ value: 'apple' });
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'Apple' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ignores clicks on a disabled option', async () => {
    const { user, trigger, onChange } = setup();
    await user.click(trigger);
    const banana = screen.getByRole('option', { name: 'Banana' });
    expect(banana).toHaveAttribute('aria-disabled', 'true');
    await user.click(banana);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('ignores Enter while an IME is composing', async () => {
    const { user, trigger, onChange } = setup();
    await user.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Enter', isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
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

  it('never opens when disabled', async () => {
    const { user, trigger } = setup({ disabled: true });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes only the menu on Escape inside a Modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithI18n(
      <Modal open title="Pick" onClose={onClose}>
        <Controlled />
      </Modal>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Fruit' });
    await user.click(trigger);
    const listbox = screen.getByRole('listbox');
    expect(screen.getByRole('dialog').contains(listbox)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes only the menu on Escape from the search box inside a Modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithI18n(
      <Modal open title="Pick" onClose={onClose}>
        <Controlled options={many} aria-label="Subject" />
      </Modal>,
    );
    await user.click(screen.getByRole('combobox', { name: 'Subject' }));
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Subject' })).toHaveFocus();
  });

  it('closes the menu and refocuses the trigger on Tab from the search box inside a Modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithI18n(
      <Modal open title="Pick" onClose={onClose}>
        <Controlled options={many} aria-label="Subject" />
      </Modal>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Subject' });
    await user.click(trigger);
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveFocus();
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows no search box for up to 10 options', async () => {
    const user = userEvent.setup();
    renderWithI18n(<Controlled options={many.slice(0, 10)} aria-label="Subject" />);
    await user.click(screen.getByRole('combobox', { name: 'Subject' }));
    expect(screen.queryByRole('combobox', { name: 'Search' })).toBeNull();
  });

  it('shows a search box above 10 options that filters, picks and reports no matches', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithI18n(<Controlled options={many} aria-label="Subject" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: 'Subject' }));
    const search = screen.getByRole('combobox', { name: 'Search' });
    expect(search).toHaveFocus();
    await user.type(search, 'IST');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Chemistry', 'History']);
    expect(search).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Chemistry' }).id);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('history');
    expect(screen.getByRole('combobox', { name: 'Subject History' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: /^Subject/ }));
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('honours searchable={false} and a custom search placeholder', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithI18n(<Controlled options={many} aria-label="Subject" searchable={false} />);
    await user.click(screen.getByRole('combobox', { name: 'Subject' }));
    expect(screen.queryByRole('combobox', { name: 'Search' })).not.toBeInTheDocument();
    unmount();
    renderWithI18n(<Controlled aria-label="Fruit" searchable searchPlaceholder="Find fruit…" />);
    await user.click(screen.getByRole('combobox', { name: 'Fruit' }));
    expect(screen.getByRole('combobox', { name: 'Find fruit…' })).toHaveFocus();
  });

  it('is named by a Field label and marked invalid on error', () => {
    renderWithI18n(
      <Field label="Fruit" error="Pick one">
        <Select options={fruits} value="" onChange={() => {}} />
      </Field>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Fruit' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription('Pick one');
  });

  it('labels the listbox from the Field label', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <Field label="Fruit">
        <Select options={fruits} value="" onChange={() => {}} />
      </Field>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Fruit' });
    await user.click(trigger);
    const listbox = screen.getByRole('listbox', { name: 'Fruit' });
    const labelledBy = document.getElementById(listbox.getAttribute('aria-labelledby') ?? '');
    expect(labelledBy?.tagName).toBe('LABEL');
    expect(labelledBy).toBe(screen.getByText('Fruit', { selector: 'label' }));
    expect(labelledBy).not.toBe(trigger);
  });

  it('prefers aria-labelledby over aria-label for the listbox', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <>
        <span id="ext">External</span>
        <Select options={fruits} value="" onChange={() => {}} aria-labelledby="ext" aria-label="Ignored" />
      </>,
    );
    await user.click(screen.getByRole('combobox', { name: 'External' }));
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-labelledby', 'ext');
    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-label');
  });

  it('keeps the selected value in the name with aria-labelledby or a Field label', () => {
    const { unmount } = renderWithI18n(
      <>
        <span id="ext">External</span>
        <Select options={fruits} value="cherry" onChange={() => {}} aria-labelledby="ext" />
      </>,
    );
    expect(screen.getByRole('combobox')).toHaveAccessibleName('External Cherry');
    unmount();
    renderWithI18n(
      <Field label="Fruit">
        <Select options={fruits} value="apple" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole('combobox')).toHaveAccessibleName('Fruit Apple');
  });

  it('renders a hidden input when name is set', () => {
    const { container } = renderWithI18n(
      <Select options={fruits} value="cherry" onChange={() => {}} name="fruit" aria-label="Fruit" />,
    );
    const hidden = container.querySelector('input[type="hidden"]');
    expect(hidden).toHaveAttribute('name', 'fruit');
    expect(hidden).toHaveValue('cherry');
  });

  it('renders groups in first-appearance order', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <Select
        aria-label="Food"
        value=""
        onChange={() => {}}
        options={[
          { value: 'carrot', label: 'Carrot', group: 'Vegetables' },
          { value: 'apple', label: 'Apple', group: 'Fruit' },
          { value: 'pea', label: 'Pea', group: 'Vegetables' },
        ]}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Food' }));
    const groups = within(screen.getByRole('listbox')).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Vegetables', 'Fruit']);
    expect(within(groups[0]!).getAllByRole('option').map((o) => o.textContent)).toEqual(['Carrot', 'Pea']);
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('Pea');
  });
});
