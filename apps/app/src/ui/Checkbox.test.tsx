// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

function Controlled({ onChange, ...rest }: Partial<React.ComponentProps<typeof Checkbox>>) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      label="Active"
      {...rest}
      checked={checked}
      onChange={(c) => {
        setChecked(c);
        onChange?.(c);
      }}
    />
  );
}

describe('Checkbox', () => {
  it('is a named checkbox that toggles via click on the label', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Active' });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText('Active'));
    expect(box).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('toggles from the keyboard with Space', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('describes the box with its hint and reflects indeterminate', () => {
    render(<Checkbox checked={false} onChange={() => {}} label="All" hint="Every grade" indeterminate />);
    const box = screen.getByRole('checkbox', { name: 'All' });
    expect(box).toHaveAccessibleDescription('Every grade');
    expect(box).toBePartiallyChecked();
  });

  it('does not fire when disabled', async () => {
    const onChange = vi.fn();
    render(<Controlled disabled onChange={onChange} />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
    await userEvent.click(screen.getByText('Active'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('passes aria-invalid and name', () => {
    render(<Controlled aria-invalid name="agree" />);
    const box = screen.getByRole('checkbox');
    expect(box).toBeInvalid();
    expect(box).toHaveAttribute('name', 'agree');
  });
});
