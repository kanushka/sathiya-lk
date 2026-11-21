// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { School, SchoolReport } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { ReportsPage } from './ReportsPage';
import { SuperLayout } from './SuperLayout';

const opts = { ctx, claims: { super: true } };
const school = (id: string, nameEn: string, status: 'active' | 'disabled' = 'active'): School => ({
  ...ctx.school,
  id,
  nameEn,
  nameSi: undefined,
  status,
});
const schools = { loading: false, data: [school('a', 'Siripura Central College'), school('b', 'Hill View', 'disabled')] };
const report = (id: string, over: Partial<SchoolReport>): SchoolReport => ({
  id,
  schoolId: 'a',
  reason: 'fake',
  createdAt: Date.UTC(2026, 10, 1),
  status: 'open',
  ...over,
});
const reports = {
  loading: false,
  data: [
    report('r-old', { createdAt: Date.UTC(2026, 9, 5), reason: 'duplicate', details: 'Same as another school' }),
    report('r-new', { createdAt: Date.UTC(2026, 10, 15), reason: 'abuse', details: 'Offensive name', email: 'who@example.com' }),
    report('r-closed', { status: 'closed', details: 'old closed one' }),
    report('r-unknown', { schoolId: 'zzz', createdAt: Date.UTC(2026, 10, 10), reason: 'other' }),
    report('r-disabled', { schoolId: 'b', createdAt: Date.UTC(2026, 8, 1) }),
  ],
};

function renderPage(over: { writer?: { closeReport: ReturnType<typeof vi.fn> }; setStatus?: ReturnType<typeof vi.fn> } = {}) {
  const writer = over.writer ?? { closeReport: vi.fn().mockResolvedValue(undefined) };
  const setStatus = over.setStatus ?? vi.fn().mockResolvedValue({ ok: true });
  renderWithSchool(<ReportsPage reports={reports} schools={schools} writer={writer} setStatus={setStatus} />, opts);
  return { writer, setStatus };
}

const rows = () => screen.getAllByRole('row').slice(1);

describe('ReportsPage', () => {
  it('lists only open reports newest first with link, reason, details and email', () => {
    renderPage();
    expect(rows()).toHaveLength(4);
    expect(rows().map((r) => within(r).getAllByRole('cell')[1]?.textContent)).toEqual(['Abuse', 'Other', 'Duplicate', 'Fake school']);
    expect(screen.queryByText('old closed one')).toBeNull();
    const first = rows()[0]!;
    expect(within(first).getByRole('link', { name: 'Siripura Central College' })).toHaveAttribute('href', '/s/a');
    expect(within(first).getByText('Offensive name')).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: 'who@example.com' })).toHaveAttribute('href', 'mailto:who@example.com');
    expect(within(first).getByText('15 Nov 2026')).toBeInTheDocument();
  });

  it('falls back to the school id when the school is unknown', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'zzz' })).toHaveAttribute('href', '/s/zzz');
  });

  it('shows empty and error states', () => {
    const { unmount } = renderWithSchool(<ReportsPage reports={{ loading: false, data: [] }} schools={schools} />, opts);
    expect(screen.getByText('No open reports')).toBeInTheDocument();
    unmount();
    renderWithSchool(<ReportsPage reports={{ loading: false, data: [], error: new Error('x') }} schools={schools} />, opts);
    expect(screen.getByText('Could not load reports.')).toBeInTheDocument();
  });

  it('closes a report by id and toasts', async () => {
    const { writer } = renderPage();
    await userEvent.click(within(rows()[0]!).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(writer.closeReport).toHaveBeenCalledWith('r-new'));
    expect(await screen.findByText('Report closed')).toBeInTheDocument();
  });

  it('shows a translated error toast when closing fails', async () => {
    renderPage({ writer: { closeReport: vi.fn().mockRejectedValue(new Error('boom')) } });
    await userEvent.click(within(rows()[0]!).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Could not close report: Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).toBeNull();
  });

  it('suspends the school only after confirm', async () => {
    const { setStatus } = renderPage();
    await userEvent.click(within(rows()[0]!).getByRole('button', { name: 'Suspend school' }));
    expect(setStatus).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable school' }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith({ schoolId: 'a', status: 'disabled' }));
    expect(await screen.findByText('Siripura Central College disabled')).toBeInTheDocument();
  });

  it('offers no suspend for an already disabled school', () => {
    renderPage();
    const row = rows()[3]!;
    expect(within(row).getByText('Hill View')).toBeInTheDocument();
    expect(within(row).getByText('Disabled')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Suspend school' })).toBeNull();
  });
});

describe('Reports nav badge', () => {
  const layout = (data: SchoolReport[], loading = false) =>
    renderWithSchool(
      <Routes>
        <Route path="*" element={<SuperLayout openReports={{ data, loading }}><p>body</p></SuperLayout>} />
      </Routes>,
      { ...opts, route: '/super' },
    );

  it('links to /super/reports with the open count', () => {
    layout(reports.data);
    const link = screen.getByRole('link', { name: /Reports/ });
    expect(link).toHaveAttribute('href', '/super/reports');
    expect(within(link).getByText('4')).toBeInTheDocument();
  });

  it('hides the badge at zero and while loading', () => {
    const { unmount } = layout([report('x', { status: 'closed' })]);
    expect(within(screen.getByRole('link', { name: /Reports/ })).queryByText(/\d/)).toBeNull();
    unmount();
    layout(reports.data, true);
    expect(within(screen.getByRole('link', { name: /Reports/ })).queryByText(/\d/)).toBeNull();
  });
});
