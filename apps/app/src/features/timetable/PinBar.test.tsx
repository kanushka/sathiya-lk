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
    progress: { placed: 3, needed: 5, left: 2, over: 0, full: [], unit: 'periods' },
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
  it('sits fixed at the bottom on phones and sticky at the top from md up', () => {
    setup();
    expect(bar()).toHaveClass('fixed', 'inset-x-0', 'bottom-0', 'md:sticky', 'md:top-0', 'md:bottom-auto', 'md:rounded-[14px]');
  });

  it('keeps the detail line to one truncated line and hides the meter on phones', () => {
    setup({ detail: 'Buddhism: Mr. A' });
    expect(screen.getByText('Buddhism: Mr. A')).toHaveClass('truncate', 'md:whitespace-normal');
    expect(screen.getByText('Buddhism: Mr. A')).not.toHaveClass('hidden');
    expect(screen.getByRole('meter', { hidden: true })).toHaveClass('hidden', 'md:block');
  });

  it('stretches its buttons across the bar on phones', () => {
    setup();
    expect(screen.getByRole('button', { name: /Done/ })).toHaveClass('flex-1', 'md:flex-none');
  });

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
    setup({ progress: { placed: 5, needed: 5, left: 0, over: 0, full: [], unit: 'periods' } });
    expect(screen.getByText('5 of 5 placed · complete')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Suggest/ })).not.toBeInTheDocument();
  });

  it('warns with a text cue when over the weekly plan', () => {
    setup({ progress: { placed: 7, needed: 5, left: 0, over: 2, full: [], unit: 'periods' } });
    expect(screen.getByText('7 of 5 placed')).toBeInTheDocument();
    expect(screen.getByText('+2 over')).toBeInTheDocument();
    const meter = screen.getByRole('meter', { name: 'Weekly plan progress' });
    expect(meter).toHaveAttribute('data-over', 'true');
    expect(meter).toHaveAttribute('aria-valuemax', '7');
  });

  it('says which joined class is at its target and offers no suggestions', () => {
    setup({ progress: { placed: 0, needed: 3, left: 0, over: 0, full: [{ classId: 'c6b', placed: 3, needed: 3, left: 0, unit: 'periods' }], unit: 'periods' }, fullNote: '6B already has 3/3' });
    expect(screen.getByText('0 of 3 placed · 6B already has 3/3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Suggest/ })).not.toBeInTheDocument();
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

  it('shows minute progress and suggest without a slot count', () => {
    setup({ progress: { placed: 40, needed: 190, left: 150, over: 0, full: [], unit: 'minutes' } });
    expect(screen.getByText('40 min of 3h 10m placed · 2h 30m to go')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest slots for 2h 30m' })).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', '40 min/3h 10m');
  });
});
