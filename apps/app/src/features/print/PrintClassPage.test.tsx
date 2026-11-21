// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ClassSnapshot } from '@sathiya/core';
import { C, ctx, entries } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { PrintClassPage } from './PrintClassPage';
import { PublishedDocContext } from './usePrintSnapshot';

function setup(id: string = C.c6b, query = '', lang: 'en' | 'si' = 'en', published?: (path: string | null) => { data?: unknown; loading: boolean }) {
  const ui = <PrintClassPage />;
  return renderWithSchool(
    published ? <PublishedDocContext.Provider value={published as never}>{ui}</PublishedDocContext.Provider> : ui,
    { ctx, entries, lang, route: `/admin/print/class/${id}${query}`, path: '/admin/print/class/:id' },
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PrintClassPage', () => {
  it('renders the header and 40 grid slots for 6B (36 filled)', () => {
    setup();
    expect(screen.getByText('Siripura Central College')).toBeInTheDocument();
    expect(screen.getByText('සිරිපුර මධ්‍ය විද්‍යාලය')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grade 6 · 6B' })).toBeInTheDocument();
    expect(screen.getByText(/Timetable 2026/)).toHaveTextContent('Class teacher Mrs. N. Perera');
    const slots = screen.getAllByTestId('print-slot');
    expect(slots).toHaveLength(40);
    expect(slots.filter((s) => s.dataset.empty === 'true')).toHaveLength(4);
    expect(screen.getByText(/^Interval · 10:30 – 10:50$/)).toBeInTheDocument();
  });

  it('shows the printed date and made-with footer', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T09:00:00'));
    setup();
    expect(screen.getByText(/Printed 21 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Made with Sathiya/)).toBeInTheDocument();
  });

  it('labels group cells from otherClasses and notes the groups', () => {
    setup();
    const mon2 = screen.getAllByTestId('print-slot').find((s) => s.dataset.day === '2' && s.dataset.period === '2')!;
    expect(mon2).toHaveTextContent('Religion');
    expect(mon2).toHaveTextContent('Group · with 6A');
    expect(mon2).not.toHaveTextContent('Group · 6A');
    expect(screen.getByText(/run as groups/)).toBeInTheDocument();
  });

  it('uses Sinhala labels when lang is si', () => {
    setup(C.c6b, '', 'si');
    const mon2 = screen.getAllByTestId('print-slot').find((s) => s.dataset.day === '2' && s.dataset.period === '2')!;
    expect(mon2).toHaveTextContent('කණ්ඩායම');
    expect(screen.getByRole('button', { name: 'මුද්‍රණය' })).toBeInTheDocument();
    expect(screen.getByText(/සිරිපුර මධ්‍ය විද්‍යාලය/)).toBeInTheDocument();
  });

  it('prints once when auto=1', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    setup(C.c6b, '?auto=1');
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(screen.getAllByTestId('print-slot')).toHaveLength(40);
  });

  it('does not auto print without auto=1', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    setup();
    expect(print).not.toHaveBeenCalled();
  });

  it('shows an empty state for an unknown class', () => {
    setup('nope');
    expect(screen.getByText('Class not found')).toBeInTheDocument();
  });

  it('shows not-published when the published doc is missing', () => {
    setup(C.c6b, '?published=1', 'en', () => ({ loading: false }));
    expect(screen.getByText('Not published yet')).toBeInTheDocument();
    expect(screen.queryAllByTestId('print-slot')).toHaveLength(0);
  });

  it('renders a published snapshot', () => {
    const snap = { classId: C.c6b, className: '6B', gradeNumber: 6, rows: { 0: [{ type: 'period', start: '07:45', end: '08:30' }], 1: [], 2: [], 3: [], 4: [] }, cells: [{ day: 0, period: 1, start: '07:45', end: '08:30', title: 'Maths', sub: 'X', color: '', isGroup: false }], yearLabel: '2025', schoolName: { nameEn: 'Pub School' } } as unknown as ClassSnapshot;
    setup(C.c6b, '?published=1', 'en', () => ({ data: snap, loading: false }));
    expect(screen.getByText('Pub School')).toBeInTheDocument();
    expect(screen.getAllByTestId('print-slot')).toHaveLength(1);
    expect(within(screen.getAllByTestId('print-slot')[0]!).getByText('Maths')).toBeInTheDocument();
  });
});
