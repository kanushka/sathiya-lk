// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { initialsOf, ListInitials, ListRow, ListSection, ListTile } from './GroupedList';

describe('GroupedList', () => {
  it('labels each section by its heading and shows the count', () => {
    render(
      <ListSection title="Not linked" count={12} tone="warning">
        <ListRow title="Mrs. S. Wickramasinghe" detail="SCC003 · Primary" />
      </ListSection>,
    );
    const section = screen.getByRole('region', { name: /Not linked/ });
    expect(within(section).getByText('12')).toHaveClass('bg-warning-soft');
    expect(within(section).getByRole('list')).toBeInTheDocument();
    expect(within(section).getByRole('listitem')).toHaveTextContent('Mrs. S. WickramasingheSCC003 · Primary');
  });

  it('bare sections render children without the list frame', () => {
    render(
      <ListSection title="Join requests" bare>
        <div>card</div>
      </ListSection>,
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('card')).toBeInTheDocument();
  });

  it('opens the row and runs the trailing action separately', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    const link = vi.fn();
    render(
      <ul>
        <ListRow title="Mr. P. Bandara" detail="SCC014" onOpen={open} openLabel="Edit Mr. P. Bandara" action={{ label: 'Link', ariaLabel: 'Link Mr. P. Bandara', onClick: link }} />
      </ul>,
    );
    const row = screen.getByRole('button', { name: 'Edit Mr. P. Bandara' });
    expect(row).toHaveClass('min-h-[60px]');
    const action = screen.getByRole('button', { name: 'Link Mr. P. Bandara' });
    expect(action).toHaveClass('min-h-11', 'min-w-11', 'text-brand');
    await user.click(action);
    expect(link).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    await user.click(row);
    expect(open).toHaveBeenCalledOnce();
  });

  it('reaches the row and the action with Tab and Enter', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    const del = vi.fn();
    render(
      <ul>
        <ListRow title="Dancing" onOpen={open} openLabel="Edit Dancing" action={{ label: 'Delete', tone: 'danger', onClick: del }} />
      </ul>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Edit Dancing' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledOnce();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('text-danger');
    await user.keyboard(' ');
    expect(del).toHaveBeenCalledOnce();
  });

  it('a busy or disabled action does not run', async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    render(
      <ul>
        <ListRow title="A" action={{ label: 'Link', onClick: go, loading: true }} />
      </ul>,
    );
    const action = screen.getByRole('button', { name: 'Link' });
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute('aria-busy', 'true');
    await user.click(action);
    expect(go).not.toHaveBeenCalled();
  });

  it('a row without onOpen is not a button and shows its meta', () => {
    render(
      <ul>
        <ListRow title="Art" detail="චිත්‍ර" meta="3 slots" lead={<ListTile label="Art" color="#E6DDF3" />} />
      </ul>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('3 slots')).toBeInTheDocument();
  });

  it('makes initials from a name without its title', () => {
    expect(initialsOf('Mrs. S. Wickramasinghe')).toBe('SW');
    expect(initialsOf('Mr. R. Silva')).toBe('RS');
    expect(initialsOf('Principal Siripura')).toBe('PS');
    expect(initialsOf('Ananda')).toBe('A');
    expect(initialsOf('Rev. Fr. M. Silva')).toBe('MS');
    expect(initialsOf('')).toBe('');
    const { container } = render(<ListInitials name="Mr. P. Bandara" />);
    expect(container.firstChild).toHaveTextContent('PB');
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
