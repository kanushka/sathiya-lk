// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RadioGroup } from './RadioGroup';

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
];

function Controlled({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('a');
  return (
    <RadioGroup
      name="letters"
      label="Letters"
      options={options}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('RadioGroup', () => {
  it('renders a named group with radios', () => {
    render(<Controlled />);
    expect(screen.getByRole('group', { name: 'Letters' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Gamma' })).not.toBeChecked();
  });

  it('selects on click', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.click(screen.getByText('Gamma'));
    expect(screen.getByRole('radio', { name: 'Gamma' })).toBeChecked();
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('moves with arrow keys, skipping disabled options', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toBeChecked();
  });

  it('disables individual options', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeDisabled();
    await userEvent.click(screen.getByText('Beta'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws the checked radio with a 5.5px border and never the 1.5px one', () => {
    render(<Controlled />);
    const visual = (name: string) => screen.getByRole('radio', { name }).nextElementSibling;
    expect(visual('Alpha')).toHaveClass('border-[5.5px]');
    expect(visual('Alpha')).not.toHaveClass('border-[1.5px]');
    expect(visual('Gamma')).toHaveClass('border-[1.5px]');
    expect(visual('Gamma')).not.toHaveClass('border-[5.5px]');
    expect(visual('Beta')).toHaveClass('bg-surface-2');
    expect(visual('Beta')).not.toHaveClass('bg-white');
  });

  it('leaves every radio unchecked when value is null', () => {
    render(<RadioGroup name="letters" label="Letters" options={options} value={null} onChange={() => {}} />);
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0);
  });

  it('keeps each native input as a hit target over its visual, not sr-only', () => {
    render(<RadioGroup name="letters" label="Letters" options={options} value={null} onChange={() => {}} />);
    for (const input of screen.getAllByRole('radio')) {
      expect(input).not.toHaveClass('sr-only');
      expect(input).toHaveClass('absolute', 'inset-0');
      expect(input.parentElement).toHaveClass('relative');
    }
  });
});
