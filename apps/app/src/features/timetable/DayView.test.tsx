// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, TemplateRow } from '@sathiya/core';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../test/render';
import { DayPicker, DayView, defaultDay, firstRun, ModeToggle, type TimetableMode } from './DayView';

const p = (start: string, end: string): TemplateRow => ({ type: 'period', start, end });
const day: TemplateRow[] = [p('07:45', '08:20'), p('08:20', '09:00'), { type: 'interval', start: '09:00', end: '09:20' }, p('09:20', '10:00')];
const rows = { 0: day, 1: day, 2: day, 3: day, 4: day.slice(0, 2) } as Record<DayIndex, TemplateRow[]>;

function setup(over: Partial<Parameters<typeof DayView>[0]> = {}) {
  const props = {
    rows,
    day: 0 as DayIndex,
    cellsFor: (d: DayIndex, n: number) => (d === 0 && n === 1 ? { title: 'Sinhala', sub: 'Mrs. S. Wickramasinghe', color: '#F7E1E6', isGroup: false } : null),
    onSelect: vi.fn(),
    onActivate: vi.fn(),
    onClear: vi.fn(),
    ...over,
  };
  renderWithI18n(<DayView {...props} />);
  return props;
}

describe('DayView', () => {
  it('shows one full-width row per period with the interval between them', () => {
    setup();
    const list = screen.getByRole('list', { name: 'Monday periods' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'P107:45SinhalaMrs. S. Wickramasinghe',
      'P208:20+ Add lesson',
      'Interval · 09:00–09:20',
      'P309:20+ Add lesson',
    ]);
    expect(screen.getByRole('button', { name: 'Monday, period 1, 07:45–08:20: Sinhala Mrs. S. Wickramasinghe' })).toHaveStyle({ background: '#F7E1E6' });
  });

  it('opens the assign picker from an empty row', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole('button', { name: 'Monday, period 2, 08:20–09:00: empty, Add lesson' }));
    expect(props.onSelect).toHaveBeenCalledWith(0, 2);
    expect(props.onActivate).toHaveBeenCalledWith(0, 2);
  });

  it('moves with the arrow keys and clears with Delete', async () => {
    const user = userEvent.setup();
    const props = setup();
    const first = screen.getByRole('button', { name: /^Monday, period 1,/ });
    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^Monday, period 2,/ })).toHaveFocus();
    await user.keyboard('{ArrowUp}{Delete}');
    expect(props.onClear).toHaveBeenCalledWith(0, 1);
  });

  it('read-only rows say Free and do nothing', async () => {
    const user = userEvent.setup();
    const props = setup({ readOnly: true });
    const free = screen.getByRole('button', { name: 'Monday, period 2, 08:20–09:00: empty' });
    expect(free).toHaveTextContent('Free');
    await user.click(free);
    expect(props.onActivate).not.toHaveBeenCalled();
    fireEvent.keyDown(free, { key: 'Delete' });
    expect(props.onClear).not.toHaveBeenCalled();
  });

  it('shows the pin overlay in place of the lesson', () => {
    setup({ overlay: () => ({ label: 'pin here', className: 'bg-success-soft', content: <span>Free</span> }) });
    expect(screen.getAllByRole('button', { name: 'pin here' })).toHaveLength(3);
  });
});

describe('DayPicker and ModeToggle', () => {
  it('day buttons show done / total and move with arrow keys', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [d, setD] = useState<DayIndex>(0);
      return <DayPicker value={d} onChange={setD} stat={(x) => ({ done: x, total: 6 })} />;
    }
    renderWithI18n(<Harness />);
    const mon = screen.getByRole('radio', { name: 'Monday, 0 of 6' });
    expect(mon).toHaveAttribute('aria-checked', 'true');
    expect(mon).toHaveTextContent('Mon0/6');
    expect(mon).toHaveClass('h-11');
    mon.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Tuesday, 1 of 6' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Tuesday, 1 of 6' })).toHaveFocus();
  });

  it('Day / Week is a radio group of 44px buttons', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [m, setM] = useState<TimetableMode>('day');
      return <ModeToggle value={m} onChange={setM} />;
    }
    renderWithI18n(<Harness />);
    const group = screen.getByRole('radiogroup', { name: 'Timetable view' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Day', 'Week']);
    await user.click(screen.getByRole('radio', { name: 'Week' }));
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveClass('h-11');
  });
});

describe('defaultDay and firstRun', () => {
  beforeEach(() => localStorage.clear());

  it('starts on today from Monday to Friday and on Monday at the weekend', () => {
    expect(defaultDay(new Date('2026-11-25T08:00:00'))).toBe(2);
    expect(defaultDay(new Date('2026-11-28T08:00:00'))).toBe(0);
    expect(defaultDay(new Date('2026-11-29T08:00:00'))).toBe(0);
  });

  it('is true once per key', () => {
    expect(firstRun('k')).toBe(true);
    expect(firstRun('k')).toBe(false);
    expect(firstRun('other')).toBe(true);
  });
});
