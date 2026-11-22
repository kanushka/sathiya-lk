// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { School, SchoolReport } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import { ReportsPage } from './ReportsPage';
import { SchoolDetail } from './SchoolDetail';
import { UsageSourceProvider, type UsageSource } from './source';

const opts = { ctx, claims: { super: true } };
const school = (over: Partial<School> = {}): School => ({ ...ctx.school, id: 'a', nameEn: 'Fake College', nameSi: undefined, censusNo: '54321', ...over });
const source: UsageSource = { counts: async () => ({ teachers: 0, classes: 0, entries: null, lastActivity: null }) };

function renderDetail(s: School, release = vi.fn().mockResolvedValue({ censusNo: '54321', freed: true })) {
  renderWithSchool(
    <UsageSourceProvider value={source}>
      <SchoolDetail school={{ loading: false, data: s }} setStatus={vi.fn()} releaseCensus={release} />
    </UsageSourceProvider>,
    opts,
  );
  return release;
}

describe('Release census number on SchoolDetail', () => {
  it('asks for confirmation naming the number and the school, then releases', async () => {
    const release = renderDetail(school());
    await userEvent.click(screen.getByRole('button', { name: 'Release census number' }));
    expect(release).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Release census number 54321?' });
    expect(dialog).toHaveTextContent('removes census number 54321 from Fake College');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release 54321' }));
    await waitFor(() => expect(release).toHaveBeenCalledWith({ schoolId: 'a' }));
    expect(await screen.findByText('Census number 54321 released from Fake College')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does nothing on cancel', async () => {
    const release = renderDetail(school());
    await userEvent.click(screen.getByRole('button', { name: 'Release census number' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(release).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('says when the number was only cleared from the school', async () => {
    renderDetail(school(), vi.fn().mockResolvedValue({ censusNo: '54321', freed: false }));
    await userEvent.click(screen.getByRole('button', { name: 'Release census number' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Release 54321' }));
    expect(await screen.findByText('Census number 54321 cleared from Fake College (it was not reserved for this school)')).toBeInTheDocument();
  });

  it('shows a translated error toast on failure', async () => {
    renderDetail(school(), vi.fn().mockRejectedValue(new ApiError('not-allowed', 'nope')));
    await userEvent.click(screen.getByRole('button', { name: 'Release census number' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Release 54321' }));
    expect(await screen.findByText(/^Could not release census number: /)).toBeInTheDocument();
  });

  it('is not offered for a school without a census number, and shows the released one', () => {
    renderDetail(school({ censusNo: undefined, releasedCensusNo: '54321', censusReleasedAt: Date.UTC(2026, 10, 20), censusReleasedBy: 'u-super' }));
    expect(screen.queryByRole('button', { name: 'Release census number' })).toBeNull();
    expect(screen.getByText('Census number released')).toBeInTheDocument();
    expect(screen.getByText(/^54321 on /)).toBeInTheDocument();
  });
});

describe('Release census number on ReportsPage', () => {
  const report: SchoolReport = { id: 'r1', schoolId: 'a', reason: 'fake', createdAt: Date.UTC(2026, 10, 1), status: 'open' };
  const render = (s: School) => {
    const release = vi.fn().mockResolvedValue({ censusNo: '54321', freed: true });
    renderWithSchool(
      <ReportsPage
        reports={{ loading: false, data: [report] }}
        schools={{ loading: false, data: [s] }}
        writer={{ closeReport: vi.fn() }}
        setStatus={vi.fn()}
        releaseCensus={release}
      />,
      opts,
    );
    return release;
  };

  it('releases the number of a suspended school after confirm', async () => {
    const release = render(school({ status: 'disabled' }));
    const row = screen.getAllByRole('row')[1]!;
    await userEvent.click(within(row).getByRole('button', { name: 'Release census number' }));
    const dialog = screen.getByRole('dialog', { name: 'Release census number 54321?' });
    expect(dialog).toHaveTextContent('Fake College');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release 54321' }));
    await waitFor(() => expect(release).toHaveBeenCalledWith({ schoolId: 'a' }));
    expect(await screen.findByText('Census number 54321 released from Fake College')).toBeInTheDocument();
  });

  it('cannot confirm twice while the release is running', async () => {
    let finish!: (v: unknown) => void;
    const release = vi.fn(() => new Promise((r) => (finish = r)));
    renderWithSchool(
      <ReportsPage reports={{ loading: false, data: [report] }} schools={{ loading: false, data: [school()] }} writer={{ closeReport: vi.fn() }} setStatus={vi.fn()} releaseCensus={release as never} />,
      opts,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Release census number' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release 54321' }));
    expect(within(dialog).getByRole('button', { name: 'Release 54321' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(release).toHaveBeenCalledTimes(1);
    finish({ censusNo: '54321', freed: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('is not offered when the school has no census number', () => {
    render(school({ censusNo: undefined }));
    expect(screen.queryByRole('button', { name: 'Release census number' })).toBeNull();
  });
});
