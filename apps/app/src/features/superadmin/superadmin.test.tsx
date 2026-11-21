// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { School } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContextProvider, type AuthState } from '../../app/AuthProvider';
import { LangContextProvider } from '../../app/LangProvider';
import { ApiError } from '../../lib/callable';
import { renderWithSchool } from '../../test/renderWithSchool';
import type { SchoolRecord } from './school';
import { SchoolDetail } from './SchoolDetail';
import { SchoolsPage } from './SchoolsPage';
import { SuperAdminLink } from './SuperAdminLink';
import { SuperLayout } from './SuperLayout';
import { UsagePage } from './UsagePage';
import { UsageSourceProvider, useUsageCounts, type UsageSource } from './source';

const base = ctx.school;
const make = (id: string, over: Partial<School>): School => ({ ...base, id, activeYearId: undefined, ...over });
const schools: School[] = [
  make('a', { nameEn: 'Siripura Central College', nameSi: 'සිරිපුර මධ්‍ය විද්‍යාලය', district: 'Kandy', staffPrefix: 'SCC', status: 'active', activeYearId: 'y1' }),
  make('b', { nameEn: 'Lakeside Girls', nameSi: undefined, district: 'Galle', staffPrefix: 'LSG', status: 'active' }),
  make('c', { nameEn: 'Hill View', nameSi: undefined, district: 'Kandy', staffPrefix: 'HVC', status: 'disabled' }),
];

const source: UsageSource = {
  counts: async (s) =>
    s.id === 'a'
      ? { teachers: 58, classes: 32, entries: 410, lastActivity: Date.UTC(2026, 10, 20) }
      : { teachers: 3, classes: 2, entries: null, lastActivity: null },
};
const loaded = { data: schools, loading: false };
const claims = { super: true };
const opts = { ctx, claims };

function renderPage(setStatus = vi.fn().mockResolvedValue({ ok: true })) {
  renderWithSchool(
    <UsageSourceProvider value={source}>
      <SchoolsPage schools={loaded} setStatus={setStatus} />
    </UsageSourceProvider>,
    opts,
  );
  return setStatus;
}

const rowNames = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]?.textContent ?? '');

describe('SchoolsPage', () => {
  it('disables via callable after confirm', async () => {
    const setStatus = renderPage();
    const row = screen.getByText('Siripura Central College').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Disable' }));
    expect(setStatus).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable school' }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith({ schoolId: 'a', status: 'disabled' }));
    expect(await screen.findByText('Siripura Central College disabled')).toBeInTheDocument();
  });

  it('enables without confirm', async () => {
    const setStatus = renderPage();
    const row = screen.getByText('Hill View').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Enable' }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith({ schoolId: 'c', status: 'active' }));
  });

  it('shows an error toast on failure', async () => {
    const setStatus = vi.fn().mockRejectedValue(new Error('nope'));
    renderPage(setStatus);
    const row = screen.getByText('Hill View').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Enable' }));
    expect(await screen.findByText('Could not change status: Something went wrong. Try again.')).toBeInTheDocument();
    expect(screen.queryByText(/nope/)).toBeNull();
  });

  it('maps a not-allowed error to a permission message', async () => {
    const setStatus = vi.fn().mockRejectedValue(new ApiError('not-allowed', 'raw server text'));
    renderPage(setStatus);
    const row = screen.getByText('Hill View').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Enable' }));
    expect(await screen.findByText('Could not change status: You do not have permission to do this.')).toBeInTheDocument();
  });

  it('filters by search, status and district', async () => {
    renderPage();
    expect(rowNames()).toHaveLength(3);
    await userEvent.type(screen.getByLabelText('Search schools'), 'lsg');
    expect(rowNames()).toEqual([expect.stringContaining('Lakeside Girls')]);
    await userEvent.clear(screen.getByLabelText('Search schools'));
    await userEvent.type(screen.getByLabelText('Search schools'), 'සිරිපුර');
    expect(rowNames()).toEqual([expect.stringContaining('Siripura')]);
    await userEvent.clear(screen.getByLabelText('Search schools'));
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'disabled');
    expect(rowNames()).toEqual([expect.stringContaining('Hill View')]);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'all');
    await userEvent.selectOptions(screen.getByLabelText('District'), 'Kandy');
    expect(rowNames()).toHaveLength(2);
  });

  it('does not refetch counts for loaded schools when filtering', async () => {
    const counts = vi.fn(source.counts);
    renderWithSchool(
      <UsageSourceProvider value={{ counts }}>
        <SchoolsPage schools={loaded} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    const row = screen.getByText('Siripura Central College').closest('tr') as HTMLElement;
    await within(row).findByText('58');
    expect(counts).toHaveBeenCalledTimes(3);
    await userEvent.type(screen.getByLabelText('Search schools'), 'si');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'active');
    expect(counts).toHaveBeenCalledTimes(3);
    expect(within(row).getByText('58')).toBeInTheDocument();
  });

  it('cancel in the disable confirm does not call the callable', async () => {
    const setStatus = renderPage();
    const row = screen.getByText('Siripura Central College').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Disable' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(setStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('loads counts and links to open and details', async () => {
    renderPage();
    const row = screen.getByText('Siripura Central College').closest('tr') as HTMLElement;
    expect(await within(row).findByText('58')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/s/a');
    expect(within(row).getByRole('link', { name: 'Details' })).toHaveAttribute('href', '/super/schools/a');
  });
});

describe('UsagePage', () => {
  it('renders counts, dashes for no active year and totals', async () => {
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <UsagePage schools={loaded} />
      </UsageSourceProvider>,
      opts,
    );
    const row = screen.getByText('Siripura Central College').closest('tr') as HTMLElement;
    expect(await within(row).findByText('410')).toBeInTheDocument();
    const lake = screen.getByText('Lakeside Girls').closest('tr') as HTMLElement;
    await waitFor(() => expect(within(lake).getAllByText('—').length).toBeGreaterThanOrEqual(1));
    const total = screen.getByText('Total').closest('tr') as HTMLElement;
    await waitFor(() => expect(within(total).getByText('64')).toBeInTheDocument());
    expect(within(total).getByText('36')).toBeInTheDocument();
    expect(within(total).getByText('410')).toBeInTheDocument();
  });
});

describe('UsagePage totals', () => {
  const totalRow = () => screen.getByText('Total').closest('tr') as HTMLElement;

  it('shows loading totals until every row is ready', async () => {
    const pending: UsageSource = { counts: () => new Promise(() => undefined) };
    renderWithSchool(
      <UsageSourceProvider value={pending}>
        <UsagePage schools={loaded} />
      </UsageSourceProvider>,
      opts,
    );
    expect(within(totalRow()).getAllByText('Loading…')).toHaveLength(3);
  });

  it('shows incomplete totals, not a partial sum, when a row errors', async () => {
    const partial: UsageSource = {
      counts: async (s) => {
        if (s.id === 'b') throw new Error('boom');
        return { teachers: 5, classes: 2, entries: 1, lastActivity: null };
      },
    };
    renderWithSchool(
      <UsageSourceProvider value={partial}>
        <UsagePage schools={loaded} />
      </UsageSourceProvider>,
      opts,
    );
    const lake = screen.getByText('Lakeside Girls').closest('tr') as HTMLElement;
    await waitFor(() => expect(within(lake).getAllByText('Error').length).toBeGreaterThan(0));
    await waitFor(() => expect(within(totalRow()).queryByText('Loading…')).toBeNull());
    expect(within(totalRow()).getAllByText('—')).toHaveLength(3);
    expect(within(totalRow()).getAllByTitle('Error')).toHaveLength(3);
    expect(within(totalRow()).queryByText('10')).toBeNull();
  });
});

describe('UsagePage last activity', () => {
  it('does not show Never when the last-login lookup failed', async () => {
    const src: UsageSource = { counts: async () => ({ teachers: 1, classes: 1, entries: null, lastActivity: 'error' }) };
    renderWithSchool(
      <UsageSourceProvider value={src}>
        <UsagePage schools={{ loading: false, data: [schools[1]!] }} />
      </UsageSourceProvider>,
      opts,
    );
    const row = (await screen.findByText('Lakeside Girls')).closest('tr') as HTMLElement;
    await waitFor(() => expect(within(row).queryByText('Loading…')).toBeNull());
    expect(within(row).queryByText('Never')).toBeNull();
  });
});

describe('useUsageCounts', () => {
  it('refetches when the active year changes', async () => {
    const counts = vi.fn(source.counts);
    function Host() {
      const [year, setYear] = useState('y1');
      const list = useMemo(() => [{ ...schools[0]!, activeYearId: year }], [year]);
      useUsageCounts(list);
      return <button onClick={() => setYear('y2')}>switch</button>;
    }
    renderWithSchool(
      <UsageSourceProvider value={{ counts }}>
        <Host />
      </UsageSourceProvider>,
      opts,
    );
    await waitFor(() => expect(counts).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByText('switch'));
    await waitFor(() => expect(counts).toHaveBeenCalledTimes(2));
  });
});

describe('SchoolDetail', () => {
  it('renders school facts and links to /s/:sid', async () => {
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolDetail school={{ loading: false, data: schools[0] }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect(screen.getByRole('heading', { name: 'Siripura Central College' })).toBeInTheDocument();
    expect(screen.getByText('සිරිපුර මධ්‍ය විද්‍යාලය')).toBeInTheDocument();
    expect(screen.getByText('Kandy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open read-only view' })).toHaveAttribute('href', '/s/a');
    expect(await screen.findByText('58')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
  });
});

describe('SchoolDetail errors', () => {
  it('shows a load error instead of not found', () => {
    renderWithSchool(<SchoolDetail school={{ loading: false, error: new Error('x') }} setStatus={vi.fn()} />, opts);
    expect(screen.getByText('Could not load schools.')).toBeInTheDocument();
    expect(screen.queryByText('School not found')).toBeNull();
  });

  it('shows an error label when the count fails', async () => {
    const src: UsageSource = { counts: async () => { throw new Error('x'); } };
    renderWithSchool(
      <UsageSourceProvider value={src}>
        <SchoolDetail school={{ loading: false, data: schools[0] }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect((await screen.findAllByText('Error')).length).toBeGreaterThan(0);
  });
});

describe('SuperLayout controls', () => {
  it('toggles language and signs out', async () => {
    const setLang = vi.fn();
    const signOut = vi.fn().mockResolvedValue(undefined);
    const auth: AuthState = { user: null, claims: { super: true }, loading: false, refreshClaims: async () => undefined, signOut };
    renderWithSchool(
      <AuthContextProvider value={auth}>
        <LangContextProvider value={{ lang: 'en', setLang }}>
          <SuperLayout><p>body</p></SuperLayout>
        </LangContextProvider>
      </AuthContextProvider>,
      { ctx, claims: { super: true }, route: '/super' },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Language: සිංහල' }));
    expect(setLang).toHaveBeenCalledWith('si');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('SuperLayout and SuperAdminLink', () => {
  const layout = (claims: object) =>
    renderWithSchool(
      <Routes>
        <Route path="*" element={<SuperLayout><p>body</p></SuperLayout>} />
      </Routes>,
      { ctx, claims, route: '/super' },
    );

  it('shows School admin link for admin+super', () => {
    layout({ sid: 's', role: 'admin', super: true });
    expect(screen.getByRole('link', { name: 'School admin' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Schools' })).toHaveAttribute('href', '/super');
    expect(screen.getByRole('link', { name: 'Usage' })).toHaveAttribute('href', '/super/usage');
  });

  it('hides School admin link for super only', () => {
    layout({ super: true });
    expect(screen.queryByRole('link', { name: 'School admin' })).toBeNull();
  });

  it('SuperAdminLink renders only for super', () => {
    const { unmount } = renderWithSchool(<SuperAdminLink />, { ctx, claims: { super: true } });
    expect(screen.getByRole('link', { name: 'Super admin' })).toHaveAttribute('href', '/super');
    unmount();
    renderWithSchool(<SuperAdminLink />, { ctx, claims: { sid: 's', role: 'admin' } });
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('school contact fields', () => {
  const withContact: SchoolRecord[] = [
    { ...schools[0]!, city: 'Kandy Town', address: '12 Temple Rd', phone: '081 222 3344' },
    { ...schools[1]!, city: 'Galle Fort' },
    { ...schools[2]!, city: 'Peradeniya' },
  ];

  it('shows the city under the school name and matches it in search', () => {
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolsPage schools={{ data: withContact, loading: false }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect(screen.getByText('Galle Fort')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search schools' }), { target: { value: 'perad' } });
    expect(rowNames()).toEqual([expect.stringContaining('Hill View')]);
  });

  it('shows address and phone on the detail page when present', () => {
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolDetail school={{ loading: false, data: withContact[0] }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect(screen.getByText('Kandy Town')).toBeInTheDocument();
    expect(screen.getByText('12 Temple Rd')).toBeInTheDocument();
    expect(screen.getByText('081 222 3344')).toBeInTheDocument();
  });

  it('omits address and phone rows when absent', () => {
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolDetail school={{ loading: false, data: withContact[1] }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect(screen.queryByText('Address')).toBeNull();
    expect(screen.queryByText('Phone')).toBeNull();
  });
});

describe('school type and census number', () => {
  const typed: SchoolRecord[] = [
    { ...schools[0]!, type: '1AB', censusNo: '10234' },
    { ...schools[1]!, type: 'Type 2', censusNo: '20987' },
    schools[2]!,
  ];

  it('shows type and census number in the list and searches census number', () => {
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolsPage schools={{ data: typed, loading: false }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect(screen.getByText(/1AB/)).toBeInTheDocument();
    expect(screen.getByText(/10234/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search schools' }), { target: { value: '2098' } });
    expect(rowNames()).toEqual([expect.stringContaining('Lakeside Girls')]);
  });

  it('shows type and census number on the detail page, dashes when missing', () => {
    const { unmount } = renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolDetail school={{ loading: false, data: typed[0] }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect(screen.getByText('1AB')).toBeInTheDocument();
    expect(screen.getByText('10234')).toBeInTheDocument();
    unmount();
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolDetail school={{ loading: false, data: typed[2] }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    const row = screen.getByText('Census number').closest('div') as HTMLElement;
    expect(within(row).getByText('—')).toBeInTheDocument();
  });
});
