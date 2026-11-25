// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Member, School } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import { possibleDuplicates } from './review';
import { SchoolDetail } from './SchoolDetail';
import { SchoolsPage } from './SchoolsPage';
import { UsageSourceProvider, type UsageSource } from './source';

const make = (id: string, over: Partial<School>): School => ({ ...ctx.school, id, activeYearId: undefined, censusNo: undefined, ...over });
const pending = make('p', {
  nameEn: 'Siripura Central College',
  nameSi: 'සිරිපුර මධ්‍ය විද්‍යාලය',
  district: 'Kandy',
  city: 'Siripura',
  status: 'pending',
  censusNo: '01234',
  review: { moeMatched: false },
});
const schools: School[] = [
  pending,
  make('a', { nameEn: 'Siripura Maha Vidyalaya', nameSi: undefined, district: 'Kandy', city: 'Peradeniya', status: 'active', censusNo: '01240' }),
  make('b', { nameEn: 'Gannoruwa MV', nameSi: undefined, district: 'Kandy', city: 'Kandy', status: 'active' }),
  make('c', { nameEn: 'Hindagala MV', nameSi: undefined, district: 'Kandy', city: 'Siripura', status: 'pending' }),
  make('d', { nameEn: 'Lakeside Girls', nameSi: undefined, district: 'Galle', city: 'Galle', status: 'active' }),
  make('e', { nameEn: 'Hill View', nameSi: undefined, district: 'Galle', city: 'Galle', status: 'rejected' }),
];
const members: Member[] = [{ uid: 'u1', role: 'admin', name: 'Chamari Jayasinghe', email: 'chamari@example.com' }];
const source: UsageSource = { counts: async () => ({ teachers: 0, classes: 0, entries: null, lastActivity: null }) };
const opts = { ctx, claims: { super: true } };

function renderDetail(school: School = pending, review = vi.fn().mockResolvedValue({ ok: true })) {
  renderWithSchool(
    <UsageSourceProvider value={source}>
      <SchoolDetail
        school={{ loading: false, data: school }}
        schools={{ loading: false, data: schools }}
        members={{ loading: false, data: members }}
        setStatus={vi.fn()}
        review={review}
      />
    </UsageSourceProvider>,
    opts,
  );
  return { review, user: userEvent.setup() };
}

describe('SchoolsPage pending filter', () => {
  it('counts pending schools and filters to them', async () => {
    const user = userEvent.setup();
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolsPage schools={{ loading: false, data: schools }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    const filter = screen.getByRole('radio', { name: 'Pending review, 2' });
    expect(screen.getByRole('radio', { name: 'Not approved, 1' })).toBeInTheDocument();
    await user.click(filter);
    expect(filter).toHaveAttribute('aria-checked', 'true');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0]!.textContent)).toEqual([
      expect.stringContaining('Hindagala MV'),
      expect.stringContaining('Siripura Central College'),
    ]);
    const row = rows[1]!;
    expect(within(row).getByText('Pending review')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/super/schools/p');
    expect(within(row).queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
  });
});

describe('possibleDuplicates', () => {
  it('finds similar names and same-district schools with the same city first', () => {
    const { similar, sameArea } = possibleDuplicates(pending, schools);
    expect(similar.map((s) => s.id)).toEqual(['a']);
    expect(sameArea.map((s) => s.id)).toEqual(['c', 'b']);
  });
});

describe('SchoolDetail review', () => {
  it('shows details, registrant, MOE match and possible duplicates', () => {
    renderDetail();
    const section = screen.getByRole('region', { name: 'Review' });
    expect(within(section).getByText('Chamari Jayasinghe')).toBeInTheDocument();
    expect(within(section).getByText('chamari@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Not in MOE list').length).toBeGreaterThan(0);
    const dups = within(section).getByRole('region', { name: 'Possible duplicates' });
    expect(within(dups).getByRole('link', { name: 'Siripura Maha Vidyalaya' })).toHaveAttribute('href', '/super/schools/a');
    expect(within(dups).getByText('Registered in the same area · Kandy')).toBeInTheDocument();
    expect(within(dups).getByRole('link', { name: 'Hindagala MV' })).toBeInTheDocument();
    expect(within(dups).queryByText('Lakeside Girls')).not.toBeInTheDocument();
  });

  it('shows Matched MOE list for a matched school', () => {
    renderDetail(make('m', { status: 'active', review: { moeMatched: true } }));
    expect(screen.getByText('Matched MOE list')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve school' })).not.toBeInTheDocument();
  });

  it('approves through reviewSchool', async () => {
    const { review, user } = renderDetail();
    await user.click(screen.getByRole('button', { name: 'Approve school' }));
    expect(review).toHaveBeenCalledWith({ schoolId: 'p', approve: true });
    expect(await screen.findByText('Siripura Central College approved. The school admin was emailed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve school' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject…' })).toBeDisabled();
    expect(review).toHaveBeenCalledTimes(1);
  });

  it('allows another try after a failed approve', async () => {
    const review = vi.fn().mockRejectedValue(new Error('x'));
    const { user } = renderDetail(pending, review);
    await user.click(screen.getByRole('button', { name: 'Approve school' }));
    expect(await screen.findByText(/Could not save the review/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve school' })).toBeEnabled();
  });

  it('requires a reason to reject', async () => {
    const { review, user } = renderDetail();
    await user.click(screen.getByRole('button', { name: 'Reject…' }));
    const dialog = screen.getByRole('dialog', { name: 'Reject Siripura Central College?' });
    const reason = within(dialog).getByRole('textbox', { name: /Reason/ });
    expect(reason).toHaveAttribute('maxlength', '500');
    await user.click(within(dialog).getByRole('button', { name: 'Reject and email' }));
    expect(review).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Enter a reason. The school admin will see it.')).toBeInTheDocument();
    await user.type(reason, '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Reject and email' }));
    expect(review).not.toHaveBeenCalled();
    await user.type(reason, 'Could not confirm');
    await user.click(within(dialog).getByRole('button', { name: 'Reject and email' }));
    expect(review).toHaveBeenCalledWith({ schoolId: 'p', approve: false, reason: 'Could not confirm' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('Registration rejected. Email sent with your reason.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve school' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject…' })).toBeDisabled();
  });

  it('keeps the reject dialog open when the call fails', async () => {
    const review = vi.fn().mockRejectedValue(new ApiError('not-allowed', 'raw'));
    const { user } = renderDetail(pending, review);
    await user.click(screen.getByRole('button', { name: 'Reject…' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /Reason/ }), 'No');
    await user.click(within(dialog).getByRole('button', { name: 'Reject and email' }));
    expect(await screen.findByText('Could not save the review: You do not have permission to do this.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the decision and reason for a rejected school', () => {
    renderDetail(make('r', { status: 'rejected', review: { moeMatched: false, reason: 'Fake', decidedAt: Date.UTC(2026, 10, 25), decidedBy: 'x' } }));
    const section = screen.getByRole('region', { name: 'Review' });
    expect(within(section).getByText('Rejected on 25 Nov 2026')).toBeInTheDocument();
    expect(within(section).getByText('Fake')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve school' })).not.toBeInTheDocument();
  });
});
