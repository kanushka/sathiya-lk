// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SegmentedControl, type SegmentedControlProps } from './SegmentedControl';

const options = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'term', label: 'Term' },
];

function Controlled(props: Partial<SegmentedControlProps>) {
  const [value, setValue] = useState('day');
  return <SegmentedControl aria-label="Range" options={options} {...props} value={value} onChange={setValue} />;
}

describe('SegmentedControl', () => {
  it('renders a named radiogroup with checked radio and roving tabindex', () => {
    render(<Controlled />);
    expect(screen.getByRole('radiogroup', { name: 'Range' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('tabindex', '-1');
  });

  it('selects on click', async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole('radio', { name: 'Term' }));
    expect(screen.getByRole('radio', { name: 'Term' })).toBeChecked();
  });

  it('moves and selects with arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Week' })).toBeChecked();
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Term' })).toBeChecked();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Term' })).toBeChecked();
  });

  it('applies size and tone variants', () => {
    render(<Controlled size="sm" tone="onBrand" />);
    expect(screen.getByRole('radiogroup')).toHaveClass('bg-black/15');
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveClass('h-7', 'text-on-brand');
  });
});
