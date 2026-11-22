// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { Combobox } from './Combobox';
import { Field } from './Field';
import { Modal } from './Modal';

interface Subj { id: string; name: string; group: string }
const items: Subj[] = [
  { id: 'm', name: 'Mathematics', group: 'Still needed' },
  { id: 's', name: 'Science', group: 'Already complete' },
  { id: 'e', name: 'English', group: 'Still needed' },
  { id: 'h', name: 'History', group: 'Already complete' },
];

function setup(onChange = vi.fn()) {
  renderWithI18n(
    <Combobox
      items={items}
      getKey={(s) => s.id}
      getLabel={(s) => s.name}
      groupBy={(s) => s.group}
      onChange={onChange}
      placeholder="Click to search a subject"
      searchPlaceholder="Search subject…"
    />,
  );
  return { onChange, user: userEvent.setup() };
}

describe('Combobox', () => {
  it('opens on click with a focused search box and groups in first-appearance order', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /click to search a subject/i }));
    expect(screen.getByPlaceholderText('Search subject…')).toHaveFocus();
    const listbox = screen.getByRole('listbox');
    const groups = within(listbox).getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Still needed', 'Already complete']);
    expect(within(groups[0]!).getAllByRole('option').map((o) => o.textContent)).toEqual(['Mathematics', 'English']);
  });

  it('filters by search text case-insensitively', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    await user.type(screen.getByPlaceholderText('Search subject…'), 'SCI');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Science']);
    expect(screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Already complete']);
  });

  it('shows no matches', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    await user.type(screen.getByPlaceholderText('Search subject…'), 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('picks with click', async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    await user.click(screen.getByRole('option', { name: 'History' }));
    expect(onChange).toHaveBeenCalledWith(items[3]);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ignores Enter while an IME is composing', async () => {
    const onChange = vi.fn();
    setup(onChange);
    await userEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByPlaceholderText('Search subject…'), { key: 'Enter', isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports arrows, Enter and Escape', async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const science = screen.getByRole('option', { name: 'Science' });
    expect(science).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-activedescendant', science.id);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(items[1]);
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks only the chosen value as selected', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <Combobox
        items={items}
        getKey={(s) => s.id}
        getLabel={(s) => s.name}
        value={items[3]}
        onChange={() => {}}
        placeholder="Pick"
        searchPlaceholder="Search subject…"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByRole('option', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Mathematics' })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders the listbox in document.body, outside a modal body, and keeps the modal open on pick and Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onChange = vi.fn();
    renderWithI18n(
      <Modal open title="Choose a subject" onClose={onClose}>
        <Combobox
          items={items}
          getKey={(s) => s.id}
          getLabel={(s) => s.name}
          onChange={onChange}
          placeholder="Click to search a subject"
          searchPlaceholder="Search subject…"
        />
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    const listbox = screen.getByRole('listbox');
    expect(screen.getByRole('dialog').contains(listbox)).toBe(false);
    expect(listbox.closest('[data-combobox-popover]')?.parentElement).toBe(document.body);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /click to search/i }));
    await user.click(screen.getByRole('option', { name: 'Science' }));
    expect(onChange).toHaveBeenCalledWith(items[1]);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps focus and the parent modal open when pressing popover padding or a group header', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithI18n(
      <Modal open title="Choose a subject" onClose={onClose}>
        <Combobox
          items={items}
          getKey={(s) => s.id}
          getLabel={(s) => s.name}
          groupBy={(s) => s.group}
          onChange={vi.fn()}
          placeholder="Click to search a subject"
          searchPlaceholder="Search subject…"
        />
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    const input = screen.getByRole('combobox');
    expect(input).toHaveFocus();
    const popover = input.closest('[data-combobox-popover]') as HTMLElement;
    await user.pointer({ keys: '[MouseLeft>]', target: popover });
    await user.pointer({ keys: '[/MouseLeft]', target: popover });
    await user.click(screen.getByText('Still needed'));
    expect(input).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the popover position when the list itself scrolls', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    const popover = screen.getByRole('listbox').closest('[data-combobox-popover]') as HTMLElement;
    const spy = vi.spyOn(screen.getByRole('button', { name: /click to search/i }), 'getBoundingClientRect');
    spy.mockClear();
    screen.getByRole('listbox').dispatchEvent(new Event('scroll'));
    expect(spy).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('scroll'));
    expect(spy).toHaveBeenCalled();
    expect(popover).toBeInTheDocument();
  });

  it('clears aria-activedescendant when nothing matches, then restores it', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /click to search/i }));
    const input = screen.getByRole('combobox');
    await user.type(input, 'zzz');
    await user.keyboard('{ArrowDown}');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    await user.clear(input);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant');
  });

  it('never opens when disabled', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <Combobox
        items={items}
        getKey={(s) => s.id}
        getLabel={(s) => s.name}
        onChange={vi.fn()}
        placeholder="Pick"
        searchPlaceholder="Search subject…"
        disabled
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Pick' });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('passes aria-invalid, aria-describedby and aria-labelledby to the trigger and className to the root', async () => {
    const user = userEvent.setup();
    const { container } = renderWithI18n(
      <>
        <span id="subj-label">Subject</span>
        <p id="subj-err">Pick a subject</p>
        <Combobox
          items={items}
          getKey={(s) => s.id}
          getLabel={(s) => s.name}
          onChange={vi.fn()}
          placeholder="Pick"
          searchPlaceholder="Search subject…"
          aria-invalid
          aria-describedby="subj-err"
          aria-labelledby="subj-label"
          className="w-64"
        />
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Subject' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription('Pick a subject');
    expect(container.querySelector('.w-64')).toContainElement(trigger);
    await user.click(trigger);
    expect(screen.getByRole('listbox', { name: 'Subject' })).toHaveAttribute('aria-labelledby', 'subj-label');
  });

  it('keeps the value in the trigger name with aria-labelledby and names the listbox from a field label', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithI18n(
      <>
        <span id="subj-label">Subject</span>
        <Combobox
          items={items}
          getKey={(s) => s.id}
          getLabel={(s) => s.name}
          value={items[0]}
          onChange={vi.fn()}
          placeholder="Pick"
          searchPlaceholder="Search subject…"
          aria-labelledby="subj-label"
        />
      </>,
    );
    expect(screen.getByRole('button')).toHaveAccessibleName('Subject Mathematics');
    unmount();
    renderWithI18n(
      <Field label="Subject">
        <Combobox
          items={items}
          getKey={(s) => s.id}
          getLabel={(s) => s.name}
          onChange={vi.fn()}
          placeholder="Pick"
          searchPlaceholder="Search subject…"
        />
      </Field>,
    );
    await user.click(screen.getByRole('button', { name: 'Subject' }));
    expect(screen.getByRole('listbox', { name: 'Subject' })).toBeInTheDocument();
  });
});
