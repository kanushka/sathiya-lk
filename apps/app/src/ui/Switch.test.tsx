// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('is a named switch reflecting checked', () => {
    render(<Switch checked label="Notifications" onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Notifications' })).toBeChecked();
  });

  it('calls onChange with the toggled value on click and keyboard', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} label="Notifications" onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignores clicks when disabled', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} disabled label="Notifications" onChange={onChange} />);
    expect(screen.getByRole('switch')).toBeDisabled();
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
