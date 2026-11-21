// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Entry, Year } from '@sathiya/core';
import { C, ctx, entries } from '@sathiya/core/fixtures';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LangContextProvider } from '../../app/LangProvider';
import { SchoolContextProvider, type YearState } from '../../app/SchoolProvider';
import { testI18n } from '../../test/render';
import { PrintClassPage } from './PrintClassPage';
import { PublishedDocContext } from './usePrintSnapshot';

const years: Year[] = [
  { id: 'y-2026', label: '2026', status: 'draft' },
  { id: 'y-2025', label: '2025', status: 'published' },
];

function harness(route: string, year: Partial<YearState>, docHook?: (p: string | null) => unknown) {
  const state: YearState = { years, yearId: 'y-2026', setYearId: vi.fn(), entries, loading: false, ...year };
  const ui = (s: YearState) => (
    <MemoryRouter initialEntries={[route]}>
      <LangContextProvider value={{ lang: 'en', setLang: () => undefined }}>
        <I18nextProvider i18n={testI18n}>
          <PublishedDocContext.Provider value={(docHook ?? (() => ({ loading: false }))) as never}>
            <SchoolContextProvider school={{ ...ctx, loading: false }} year={s}>
              <Routes>
                <Route path="/admin/print/class/:id" element={<PrintClassPage />} />
              </Routes>
            </SchoolContextProvider>
          </PublishedDocContext.Provider>
        </I18nextProvider>
      </LangContextProvider>
    </MemoryRouter>
  );
  const r = render(ui(state));
  return { state, rerender: (patch: Partial<YearState>) => r.rerender(ui({ ...state, ...patch })) };
}

const url = (q: string) => `/admin/print/class/${C.c6b}${q}`;

afterEach(() => vi.restoreAllMocks());

describe('usePrintSnapshot year handling', () => {
  it('switches to a known different year and waits for its entries before printing', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const setYearId = vi.fn();
    const h = harness(url('?year=y-2025&auto=1'), { setYearId });
    expect(setYearId).toHaveBeenCalledWith('y-2025');
    expect(screen.queryAllByTestId('print-slot')).toHaveLength(0);
    expect(print).not.toHaveBeenCalled();
    const later: Entry[] = entries.filter((e) => e.classIds.includes(C.c6b)).slice(0, 3);
    h.rerender({ yearId: 'y-2025', entries: later });
    expect(screen.getByText(/Timetable 2025/)).toBeInTheDocument();
    expect(screen.getAllByTestId('print-slot').filter((s) => s.dataset.empty === 'false')).toHaveLength(3);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it('ignores an unknown year', () => {
    const setYearId = vi.fn();
    harness(url('?year=bogus'), { setYearId });
    expect(setYearId).not.toHaveBeenCalled();
    expect(screen.getByText(/Timetable 2026/)).toBeInTheDocument();
  });

  it('reads the requested year path in published mode', () => {
    const seen: Array<string | null> = [];
    harness(url('?published=1&year=y-2025'), {}, (p) => (seen.push(p), { loading: false }));
    expect(seen).toContain(`schools/siripura/years/y-2025/publishedClasses/${C.c6b}`);
  });

  it('never builds a path with an empty year id while years load', () => {
    const seen: Array<string | null> = [];
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    harness(url('?published=1&auto=1'), { yearId: '', years: [] }, (p) => (seen.push(p), { loading: false }));
    expect(seen.every((p) => p === null)).toBe(true);
    expect(screen.queryByText('Not published yet')).not.toBeInTheDocument();
    expect(print).not.toHaveBeenCalled();
  });

  it('shows an error state and does not print when year data failed', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    harness(url('?auto=1'), { error: new Error('boom') });
    expect(screen.getByText('Could not load the timetable')).toBeInTheDocument();
    expect(print).not.toHaveBeenCalled();
  });
});
