import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { Combobox } from './Combobox';

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
});
