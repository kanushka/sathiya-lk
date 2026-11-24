// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, TemplateRow } from '@sathiya/core';
import { defaultTemplate, mahasen, shortFridayTemplate } from '@sathiya/core/fixtures';
import { rowsFor } from '@sathiya/core';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMatchMedia, resizeTo } from '../../test/matchMedia';
import { renderWithI18n } from '../../test/render';
import { TimetableGrid, type CellView } from './TimetableGrid';

const days: DayIndex[] = [0, 1, 2, 3, 4];
const rows = Object.fromEntries(days.map((d) => [d, rowsFor(defaultTemplate, d)])) as Record<DayIndex, TemplateRow[]>;
const cell = (title: string): CellView => ({ title, sub: 'T', color: '#ccc', isGroup: false });

function setup(props: Partial<React.ComponentProps<typeof TimetableGrid>> = {}) {
  const onSelect = vi.fn();
  const utils = renderWithI18n(
    <TimetableGrid
      rows={rows}
      cellsFor={(d, p) => (d === 0 && p === 1 ? cell('Maths') : null)}
      selected={{ day: 0, period: 1 }}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect, ...utils };
}

describe('TimetableGrid', () => {
  it('renders interval rows full width', () => {
    setup();
    const intervals = screen.getAllByText(/^Interval ·/);
    expect(intervals.length).toBe(rows[0].filter((r) => r.type === 'interval').length);
  });

  it('shows an activity row with its name across the class', () => {
    const tpl = mahasen.ctx.templates[0]!;
    const mh = Object.fromEntries(days.map((d) => [d, rowsFor(tpl, d)])) as Record<DayIndex, TemplateRow[]>;
    setup({ rows: mh });
    expect(screen.getByText('Assembly')).toBeInTheDocument();
    expect(screen.getByText('School meal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assembly/ })).toBeNull();
    expect(screen.getAllByText(/^Interval ·/)).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(tpl.rows.filter((r) => r.type === 'period').length * 5);
  });

  it('does not number activity rows as periods', () => {
    const withActivity = Object.fromEntries(
      days.map((d) => {
        const [first, ...rest] = rows[d];
        return [d, [first!, { type: 'activity', start: first!.end, end: first!.end, nameEn: 'Assembly' } as TemplateRow, ...rest]];
      }),
    ) as Record<DayIndex, TemplateRow[]>;
    setup({ rows: withActivity });
    const nPeriods = rows[0].filter((r) => r.type === 'period').length;
    expect(screen.getAllByRole('button').length).toBe(nPeriods * 5);
    expect(screen.getByRole('button', { name: new RegExp(`Monday, period ${nPeriods},`) })).toBeInTheDocument();
    expect(screen.getByText('Assembly')).toBeInTheDocument();
    expect(screen.getAllByText(/^Interval ·/).length).toBe(rows[0].filter((r) => r.type === 'interval').length);
  });

  it('keeps every period when the day with most rows has fewer periods', () => {
    const act = (nameEn: string) => ({ type: 'activity', start: '07:00', end: '07:10', nameEn }) as TemplateRow;
    const p = (n: number): TemplateRow => ({ type: 'period', start: `0${7 + n}:00`, end: `0${7 + n}:40` });
    const four = [p(1), p(2), p(3), p(4)];
    const mon = [act('A'), p(1), act('B'), p(2), act('C')];
    setup({ rows: { 0: mon, 1: four, 2: four, 3: four, 4: four } });
    expect(screen.getByRole('button', { name: /Tuesday, period 4,/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Friday, period 3,/ })).toBeInTheDocument();
  });

  it('renders a gap row per weekday when activity names or times differ', () => {
    const act = (nameEn: string, end = '07:10'): TemplateRow => ({ type: 'activity', start: '07:00', end, nameEn });
    const per: TemplateRow = { type: 'period', start: '07:10', end: '07:50' };
    const week = (f: (d: DayIndex) => TemplateRow) => Object.fromEntries(days.map((d) => [d, [f(d), per]])) as Record<DayIndex, TemplateRow[]>;
    setup({ rows: week((d) => (d === 1 ? act('Choir') : act('Assembly'))) });
    expect(screen.getAllByText('Assembly')).toHaveLength(4);
    expect(screen.getByText('Choir')).toBeInTheDocument();
    cleanup();
    setup({ rows: week((d) => act('Assembly', d === 1 ? '07:05' : '07:10')) });
    expect(screen.getAllByText('Assembly')).toHaveLength(5);
    expect(screen.getByText('07:00–07:05')).toBeInTheDocument();
    expect(screen.getAllByText('07:00–07:10')).toHaveLength(4);
    cleanup();
    setup({ rows: week(() => act('Assembly')) });
    expect(screen.getAllByText('Assembly')).toHaveLength(1);
  });

  it('renders 5 day headers and a button per slot', () => {
    setup();
    const nPeriods = rows[0].filter((r) => r.type === 'period').length;
    expect(screen.getAllByRole('button').length).toBe(nPeriods * 5);
    expect(screen.getByText('Fri')).toBeInTheDocument();
  });

  it('arrow keys move selection', () => {
    const { onSelect } = setup();
    const btn = screen.getByRole('button', { name: /Monday, period 1, .*Maths/ });
    fireEvent.keyDown(btn, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith(1, 1);
    fireEvent.keyDown(btn, { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith(0, 2);
    fireEvent.keyDown(btn, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(btn, { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('only the selected slot is in the tab order', () => {
    setup();
    const tabbable = screen.getAllByRole('button').filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('Enter calls onActivate, Delete and Backspace call onClear', () => {
    const onActivate = vi.fn();
    const onClear = vi.fn();
    setup({ onActivate, onClear });
    const btn = screen.getByRole('button', { name: /Monday, period 1, .*Maths/ });
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith(0, 1);
    fireEvent.keyDown(btn, { key: 'Delete' });
    fireEvent.keyDown(btn, { key: 'Backspace' });
    expect(onClear).toHaveBeenCalledTimes(2);
    expect(onClear).toHaveBeenCalledWith(0, 1);
  });

  it('a single click selects and activates an empty or filled slot', () => {
    const onActivate = vi.fn();
    const { onSelect } = setup({ onActivate, selected: undefined });
    fireEvent.click(screen.getByRole('button', { name: /Tuesday, period 2, .*Add lesson/ }));
    expect(onSelect).toHaveBeenCalledWith(1, 2);
    expect(onActivate).toHaveBeenCalledWith(1, 2);
    fireEvent.click(screen.getByRole('button', { name: /Monday, period 1, .*Maths/ }));
    expect(onActivate).toHaveBeenCalledWith(0, 1);
  });

  it('Enter activates an empty slot', () => {
    const onActivate = vi.fn();
    setup({ onActivate });
    const btn = screen.getByRole('button', { name: /Tuesday, period 2, .*Add lesson/ });
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith(1, 2);
  });

  it('renders stacked cells in one slot', () => {
    setup({ cellsFor: (d, p) => (d === 2 && p === 5 ? [cell('6A Maths'), cell('6B Maths')] : null) });
    expect(screen.getByText('6A Maths')).toBeInTheDocument();
    expect(screen.getByText('6B Maths')).toBeInTheDocument();
  });

  it('read-only disables activate and clear', () => {
    const onActivate = vi.fn();
    const onClear = vi.fn();
    setup({ onActivate, onClear, readOnly: true });
    const btn = screen.getByRole('button', { name: /Monday, period 1, .*Maths/ });
    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.keyDown(btn, { key: 'Delete' });
    fireEvent.click(btn);
    expect(onActivate).not.toHaveBeenCalled();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('renders each day column from its own rows (short Friday)', () => {
    const perDay = Object.fromEntries(days.map((d) => [d, rowsFor(shortFridayTemplate, d)])) as Record<DayIndex, TemplateRow[]>;
    setup({ rows: perDay, selected: undefined });
    const monP = screen.getAllByRole('button', { name: /^Monday, period/ }).length;
    const friP = screen.getAllByRole('button', { name: /^Friday, period/ }).length;
    expect(friP).toBe(monP - 1);
  });

  it('renders headerExtra', () => {
    setup({ headerExtra: (d) => <i>extra{d}</i> });
    expect(screen.getByText('extra3')).toBeInTheDocument();
  });

  it('empty editable slot shows only a plus glyph with Add lesson label', () => {
    setup();
    const btn = screen.getByRole('button', { name: /Tuesday, period 2, .*Add lesson/ });
    expect(btn).toHaveTextContent(/^\+$/);
    expect(btn).not.toHaveTextContent(/Add/);
  });

  it('empty read-only slot has no plus', () => {
    setup({ readOnly: true });
    const btn = screen.getByRole('button', { name: /Tuesday, period 2, .*empty/ });
    expect(btn).toBeEmptyDOMElement();
    expect(btn.getAttribute('aria-label')).not.toMatch(/Add lesson/);
  });

  describe('overlay', () => {
    const overlay = (d: DayIndex, p: number) =>
      d === 1 && p === 1
        ? { label: 'Tue busy', className: 'ov-busy', content: <span>Busy</span>, disabled: true }
        : d === 2 && p === 1
          ? { label: 'Wed pin', className: 'ov-free', content: <span>Free</span> }
          : null;

    it('replaces the label, look and content of a slot', () => {
      setup({ overlay });
      const busy = screen.getByRole('button', { name: 'Tue busy' });
      expect(busy).toHaveTextContent('Busy');
      expect(busy).toHaveClass('ov-busy');
      expect(busy).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: 'Wed pin' })).not.toHaveAttribute('aria-disabled');
    });

    it('does not activate a disabled slot', () => {
      const onActivate = vi.fn();
      setup({ overlay, onActivate });
      fireEvent.click(screen.getByRole('button', { name: 'Wed pin' }));
      expect(onActivate).toHaveBeenCalledWith(2, 1);
      fireEvent.click(screen.getByRole('button', { name: 'Tue busy' }));
      fireEvent.keyDown(screen.getByRole('button', { name: 'Tue busy' }), { key: 'Enter' });
      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('keeps arrow-key navigation through a disabled slot', () => {
      const { onSelect } = setup({ overlay });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Tue busy' }), { key: 'ArrowRight' });
      expect(onSelect).toHaveBeenLastCalledWith(2, 1);
    });
  });

  describe('phone layout', () => {
    let restore: () => void;
    afterEach(() => restore());

    const grid = () => screen.getByRole('group').firstElementChild as HTMLElement;
    const p1 = () => screen.getByText('P1').parentElement!;

    it('shows three day columns per screen', () => {
      restore = installMatchMedia(375);
      setup();
      expect(grid().style.gridTemplateColumns).toBe('52px repeat(5, calc(33.3333% - 23.3333px))');
      expect(grid()).not.toHaveClass('min-w-[660px]');
    });

    it('keeps the desktop grid unchanged', () => {
      restore = installMatchMedia(1280);
      setup();
      expect(grid().style.gridTemplateColumns).toBe('92px repeat(5, minmax(110px, 1fr))');
      expect(grid()).toHaveClass('min-w-[660px]');
      expect(p1()).not.toHaveClass('sticky');
    });

    it('pins period labels to the left', () => {
      restore = installMatchMedia(375);
      setup();
      expect(p1()).toHaveClass('sticky', 'left-0');
    });

    it('shows only the start time in period labels', () => {
      restore = installMatchMedia(375);
      setup();
      expect(p1()).toHaveTextContent(/^P1\d{2}:\d{2}$/);
    });

    it('snaps by day and keeps focused cells clear of the period column', () => {
      restore = installMatchMedia(375);
      setup();
      expect(screen.getByRole('group')).toHaveClass('snap-x', 'snap-mandatory', 'scroll-pl-[58px]');
      expect(screen.getByText('Tue').parentElement).toHaveClass('snap-start');
    });

    it('wraps long names inside narrow cells', () => {
      restore = installMatchMedia(375);
      setup();
      expect(screen.getByText('T')).toHaveClass('[overflow-wrap:anywhere]');
      expect(screen.getByRole('button', { name: /Monday, period 1/ })).toHaveClass('min-w-0');
    });

    it('switches layout on resize', () => {
      restore = installMatchMedia(375);
      setup();
      resizeTo(1280);
      expect(p1()).not.toHaveClass('sticky');
      expect(grid().style.gridTemplateColumns).toBe('92px repeat(5, minmax(110px, 1fr))');
    });
  });
});
