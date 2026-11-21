// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { TeacherSnapshot } from '@sathiya/core';
import { ctx, entries, T } from '@sathiya/core/fixtures';
import { render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { testI18n } from '../../test/render';
import { PrintTeacherPage } from './PrintTeacherPage';
import { PrintSheet } from './PrintSheet';

function setup(id: string = T.ananda, query = '', lang: 'en' | 'si' = 'en') {
  return renderWithSchool(<PrintTeacherPage />, { ctx, entries, lang, route: `/admin/print/teacher/${id}${query}`, path: '/admin/print/teacher/:id' });
}

afterEach(() => vi.restoreAllMocks());

describe('PrintTeacherPage', () => {
  it('renders the teacher header and grid on default-template rows', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Ven. Ananda Thero · SCC042' })).toBeInTheDocument();
    expect(screen.getAllByTestId('print-slot')).toHaveLength(40);
    const filled = screen.getAllByTestId('print-slot').filter((s) => s.dataset.empty !== 'true');
    expect(filled.length).toBeGreaterThan(0);
    expect(screen.getByText(/Made with Sathiya/)).toBeInTheDocument();
  });

  it('shows the subject in Sinhala when lang is si', () => {
    setup(T.ananda, '', 'si');
    const filled = screen.getAllByTestId('print-slot').filter((s) => s.dataset.empty !== 'true');
    expect(filled.some((s) => /බුද්ධ/.test(s.textContent ?? ''))).toBe(true);
    expect(screen.getByRole('heading', { name: /^පූජ්‍ය Ananda Thero/ })).toBeInTheDocument();
  });

  it('prints once when auto=1', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    setup(T.ananda, '?auto=1');
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it('shows an empty state for an unknown teacher', () => {
    setup('nope');
    expect(screen.getByText('Teacher not found')).toBeInTheDocument();
  });

  it('stacks two cells in one row', () => {
    const rows = { 0: [{ type: 'period', start: '07:45', end: '08:30' }], 1: [], 2: [], 3: [], 4: [] };
    const snap = {
      teacherId: 't', name: 'T One', staffId: 'S1', rows, yearLabel: '2026', schoolName: { nameEn: 'X' },
      cells: [
        { day: 0, period: 1, start: '07:45', end: '08:30', title: '6A', sub: 'Maths', color: '', isGroup: false },
        { day: 0, period: 1, start: '07:45', end: '08:30', title: '1A', sub: 'Sinhala', subSi: 'සිංහල', color: '', isGroup: false },
      ],
    } as unknown as TeacherSnapshot;
    render(
      <I18nextProvider i18n={testI18n}>
        <PrintSheet kind="teacher" snapshot={snap} lang="en" />
      </I18nextProvider>,
    );
    const slot = screen.getByTestId('print-slot');
    const cells = within(slot).getAllByTestId('print-cell');
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveTextContent('Maths · 07:45–08:30');
    expect(cells[1]).toHaveTextContent('Sinhala · 07:45–08:30');
  });

  function sheet(cells: object[]) {
    const rows = { 0: [{ type: 'period', start: '07:45', end: '08:30' }], 1: [], 2: [], 3: [], 4: [] };
    const snap = { teacherId: 't', name: 'T One', staffId: 'S1', rows, yearLabel: '2026', schoolName: { nameEn: 'X' }, cells } as unknown as TeacherSnapshot;
    render(
      <I18nextProvider i18n={testI18n}>
        <PrintSheet kind="teacher" snapshot={snap} lang="en" />
      </I18nextProvider>,
    );
    return screen.getAllByTestId('print-cell');
  }

  it('sorts class names in a joined cell title', () => {
    const [cell] = sheet([{ day: 0, period: 1, start: '07:45', end: '08:30', title: '6B+10A+6A', sub: 'Buddhism', color: '', isGroup: true }]);
    expect(cell).toHaveTextContent('⧉ 6A+6B+10A');
  });

  it('shows the cell time only when it differs from the row', () => {
    const [same] = sheet([{ day: 0, period: 1, start: '07:45', end: '08:30', title: '6A', sub: 'Maths', color: '', isGroup: false }]);
    expect(same).toHaveTextContent(/^6AMaths$/);
  });

  it('shows the cell time for a single cell at a different clock time', () => {
    const [cell] = sheet([{ day: 0, period: 1, start: '07:50', end: '08:15', title: '1A', sub: 'Sinhala', color: '', isGroup: false }]);
    expect(cell).toHaveTextContent('Sinhala · 07:50–08:15');
  });
});
