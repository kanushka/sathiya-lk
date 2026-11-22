// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../test/render';
import { PinBar, type PinBarProps } from './PinBar';

function setup(over: Partial<PinBarProps> = {}) {
  const props: PinBarProps = {
    title: 'Sinhala · Mrs. J. Ranasinghe',
    color: '#F2E2E7',
    progress: { placed: 3, needed: 5, left: 2, over: 0 },
    suggestedCount: 0,
    onSuggest: vi.fn(),
    onPinSuggested: vi.fn(),
    onDone: vi.fn(),
    ...over,
  };
  renderWithI18n(<PinBar {...props} />);
  return props;
}

const bar = () => screen.getByRole('region', { name: 'Pin mode' });

describe('PinBar', () => {
  it('names the mode, subject and teacher and shows progress to go', () => {
    setup();
    expect(bar()).toHaveTextContent('Pin mode');
    expect(bar()).toHaveTextContent('Sinhala · Mrs. J. Ranasinghe');
    expect(screen.getByText('3 of 5 placed · 2 to go')).toBeInTheDocument();
    const meter = screen.getByRole('meter', { name: 'Weekly plan progress' });
    expect(meter).toHaveAttribute('aria-valuenow', '3');
    expect(meter).toHaveAttribute('aria-valuemax', '5');
    expect(meter).not.toHaveAttribute('data-over');
  });

  it('shows an optional detail line under the title', () => {
    setup({ title: 'Religion · 6A+6B', detail: 'Buddhism: Mr. A, Islam: Mr. B' });
    expect(bar()).toHaveTextContent('Religion · 6A+6B');
    expect(screen.getByText('Buddhism: Mr. A, Islam: Mr. B')).toBeInTheDocument();
  });

  it('says complete when the plan is met', () => {
    setup({ progress: { placed: 5, needed: 5, left: 0, over: 0 } });
    expect(screen.getByText('5 of 5 placed · complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Suggest/ })).not.toBeInTheDocument();
  });

  it('warns with a text cue when over the weekly plan', () => {
    setup({ progress: { placed: 7, needed: 5, left: 0, over: 2 } });
    expect(screen.getByText('7 of 5 placed')).toBeInTheDocument();
    expect(screen.getByText('+2 over')).toBeInTheDocument();
    const meter = screen.getByRole('meter', { name: 'Weekly plan progress' });
    expect(meter).toHaveAttribute('data-over', 'true');
    expect(meter).toHaveAttribute('aria-valuemax', '7');
  });

  it('offers suggesting the remaining slots, then pinning the suggestions', async () => {
    const p = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Suggest 2 slots' }));
    expect(p.onSuggest).toHaveBeenCalled();
  });

  it('shows Pin N suggested once there are suggestions', async () => {
    const p = setup({ suggestedCount: 2 });
    expect(screen.queryByRole('button', { name: /^Suggest/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pin 2 suggested' }));
    expect(p.onPinSuggested).toHaveBeenCalled();
  });

  it('has a Done button with no Change teacher option', async () => {
    const p = setup();
    expect(screen.queryByRole('button', { name: /Change teacher/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(p.onDone).toHaveBeenCalled();
  });
});
