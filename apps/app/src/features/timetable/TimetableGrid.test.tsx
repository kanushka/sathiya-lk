import type { DayIndex, TemplateRow } from '@sathiya/core';
import { defaultTemplate, shortFridayTemplate } from '@sathiya/core/fixtures';
import { rowsFor } from '@sathiya/core';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('click selects; click on selected activates', () => {
    const onActivate = vi.fn();
    const { onSelect } = setup({ onActivate });
    fireEvent.click(screen.getByRole('button', { name: /Tuesday, period 2, .*empty/ }));
    expect(onSelect).toHaveBeenCalledWith(1, 2);
    expect(onActivate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Monday, period 1, .*Maths/ }));
    expect(onActivate).toHaveBeenCalledWith(0, 1);
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
});
