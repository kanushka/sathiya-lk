import type { School } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { SchoolDetail } from './SchoolDetail';
import { SchoolsPage } from './SchoolsPage';
import { SuperAdminLink } from './SuperAdminLink';
import { SuperLayout } from './SuperLayout';
import { UsagePage } from './UsagePage';
import { UsageSourceProvider, type UsageSource } from './source';

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
    expect(await screen.findByText('Could not change status: nope')).toBeInTheDocument();
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
