// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { School } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { SchoolDetail } from './SchoolDetail';
import { SchoolsPage } from './SchoolsPage';
import { UsageSourceProvider, type UsageSource } from './source';

const make = (id: string, over: Partial<School>): School => ({ ...ctx.school, id, activeYearId: undefined, censusNo: undefined, ...over });
const renamed = make('r', {
  nameEn: 'Batapola Sri Kalyanathissa K.V.',
  nameSi: undefined,
  status: 'active',
  censusNo: '01234',
  review: { moeMatched: true },
  nameChange: {
    nameEn: 'G/ Sri Kalyanathissa K.V.',
    nameSi: 'ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.',
    moeName: 'Batapola Sri Kalyanathissa K.V.',
    status: 'pending',
    requestedAt: Date.UTC(2026, 10, 20),
    requestedBy: 'u1',
  },
});
const source: UsageSource = { counts: async () => ({ teachers: 0, classes: 0, entries: null, lastActivity: null }) };
const opts = { ctx, claims: { super: true } };

function renderDetail(school: School = renamed, decide = vi.fn().mockResolvedValue({ ok: true })) {
  renderWithSchool(
    <UsageSourceProvider value={source}>
      <SchoolDetail school={{ loading: false, data: school }} setStatus={vi.fn()} decideName={decide} />
    </UsageSourceProvider>,
    opts,
  );
  return { decide, user: userEvent.setup() };
}

const section = () => screen.getByRole('region', { name: 'Name change' });

describe('name change review', () => {
  it('shows the MOE, current and requested names', () => {
    renderDetail();
    const s = section();
    expect(within(s).getByText('Waiting for approval')).toBeInTheDocument();
    const row = (label: string) => within(s).getByText(label).parentElement!;
    expect(row('MOE list name')).toHaveTextContent('Batapola Sri Kalyanathissa K.V.');
    expect(row('Current name')).toHaveTextContent('Batapola Sri Kalyanathissa K.V.');
    expect(row('Requested name')).toHaveTextContent('G/ Sri Kalyanathissa K.V.');
    expect(row('Requested name')).toHaveTextContent('ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.');
  });

  it('approves as requested', async () => {
    const { decide, user } = renderDetail();
    await user.click(within(section()).getByRole('button', { name: 'Approve new name' }));
    expect(decide).toHaveBeenCalledWith({ schoolId: 'r', approve: true });
    expect(await screen.findByText(/New name approved/)).toBeInTheDocument();
  });

  it('rejects with a required reason', async () => {
    const { decide, user } = renderDetail();
    await user.click(within(section()).getByRole('button', { name: 'Reject…' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reject name change' }));
    expect(decide).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/Enter a reason/)).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox'), 'Use the MOE name');
    await user.click(within(dialog).getByRole('button', { name: 'Reject name change' }));
    expect(decide).toHaveBeenCalledWith({ schoolId: 'r', approve: false, reason: 'Use the MOE name' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a rejected request without buttons', () => {
    renderDetail({ ...renamed, nameChange: { ...renamed.nameChange!, status: 'rejected', reason: 'Use the MOE name', decidedAt: 2 } });
    const s = section();
    expect(within(s).getByText('Not approved')).toBeInTheDocument();
    expect(within(s).getByText('Use the MOE name')).toBeInTheDocument();
    expect(within(s).queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no section without a request', () => {
    renderDetail({ ...renamed, nameChange: undefined });
    expect(screen.queryByRole('region', { name: 'Name change' })).not.toBeInTheDocument();
  });
});

describe('SchoolsPage name change filter', () => {
  it('counts and filters schools waiting for a name change', async () => {
    const user = userEvent.setup();
    const other = make('o', { nameEn: 'Hill View', status: 'active' });
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolsPage schools={{ loading: false, data: [renamed, other] }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    await user.click(screen.getByRole('radio', { name: 'Name change, 1' }));
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText('Name change')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/super/schools/r');
  });
});
