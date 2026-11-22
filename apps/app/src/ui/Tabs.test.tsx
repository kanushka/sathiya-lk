// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

const items = [
  { value: 'a', label: 'Classes' },
  { value: 'b', label: 'Teachers' },
  { value: 'c', label: 'Rooms' },
];

function Controlled() {
  const [value, setValue] = useState('a');
  return <Tabs aria-label="Views" items={items} value={value} onChange={setValue} />;
}

describe('Tabs', () => {
  it('renders a tablist with the selected tab and roving tabindex', () => {
    render(<Controlled />);
    expect(screen.getByRole('tablist', { name: 'Views' })).toBeInTheDocument();
    const selected = screen.getByRole('tab', { name: 'Classes' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Teachers' })).toHaveAttribute('tabindex', '-1');
  });

  it('selects on click', async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole('tab', { name: 'Rooms' }));
    expect(screen.getByRole('tab', { name: 'Rooms' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves and selects with arrows, Home and End, wrapping around', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Teachers' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Teachers' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Rooms' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Classes' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Rooms' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Classes' })).toHaveAttribute('aria-selected', 'true');
  });
});
