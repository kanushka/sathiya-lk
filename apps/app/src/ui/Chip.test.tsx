// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Chip, ToggleChip } from './Chip';

describe('Chip', () => {
  it('renders without a remove button by default', () => {
    render(<Chip>Maths</Chip>);
    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('removes via a labelled button without bubbling the click', async () => {
    const onRemove = vi.fn();
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <Chip onRemove={onRemove} removeLabel="Remove Maths">
          Maths
        </Chip>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove Maths' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onParent).not.toHaveBeenCalled();
  });

  it('can take the remove button out of the tab order and disable it', () => {
    render(
      <Chip onRemove={() => {}} removeLabel="Remove" removeTabIndex={-1} disabled>
        Maths
      </Chip>,
    );
    const b = screen.getByRole('button', { name: 'Remove' });
    expect(b).toHaveAttribute('tabindex', '-1');
    expect(b).toBeDisabled();
  });

  it('applies a colour override as background', () => {
    render(<Chip color="rgb(10, 20, 30)">Art</Chip>);
    expect(screen.getByText('Art').parentElement).toHaveStyle({ backgroundColor: 'rgb(10, 20, 30)' });
  });
});

describe('ToggleChip', () => {
  it('reflects pressed state and toggles on click and keyboard', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <ToggleChip pressed onToggle={onToggle}>
        Grade 6
      </ToggleChip>,
    );
    const b = screen.getByRole('button', { name: 'Grade 6' });
    expect(b).toHaveAttribute('aria-pressed', 'true');
    await user.click(b);
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('is not pressed by default styling and ignores clicks when disabled', async () => {
    const onToggle = vi.fn();
    render(
      <ToggleChip pressed={false} disabled onToggle={onToggle}>
        Grade 7
      </ToggleChip>,
    );
    const b = screen.getByRole('button', { name: 'Grade 7' });
    expect(b).toHaveAttribute('aria-pressed', 'false');
    expect(b).toBeDisabled();
    await userEvent.click(b);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
