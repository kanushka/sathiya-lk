// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

  it('makes the first radio tabbable when value matches none', () => {
    render(<SegmentedControl aria-label="Range" options={options} value="zzz" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('tabindex', '-1');
  });

  it('uses a white focus ring on brand tone', () => {
    render(<Controlled tone="onBrand" />);
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveClass('focus-visible:ring-white');
  });

  it('disables every radio when disabled', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl aria-label="Range" options={options} value="day" onChange={onChange} disabled />);
    const week = screen.getByRole('radio', { name: 'Week' });
    expect(week).toBeDisabled();
    await userEvent.click(week);
    expect(onChange).not.toHaveBeenCalled();
  });
});
