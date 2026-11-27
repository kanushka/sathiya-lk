// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { School, SchoolReport } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContextProvider, type AuthState } from '../../app/AuthProvider';
import { LangContextProvider } from '../../app/LangProvider';
import { renderWithSchool } from '../../test/renderWithSchool';
import { DefaultSubjectsPage } from './DefaultSubjectsPage';
import { NameChangeSection } from './NameChangeSection';
import type { PlatformWriter } from './platform';
import { ReportsPage } from './ReportsPage';
import { SchoolDetail } from './SchoolDetail';
import { SchoolsPage } from './SchoolsPage';
import { UsageSourceProvider, type UsageSource } from './source';
import { ReviewSection } from './ReviewSection';
import { SuperLayout } from './SuperLayout';

let width = 375;
const listeners = new Set<() => void>();
const original = window.matchMedia;

function resize(w: number) {
  width = w;
  act(() => listeners.forEach((fn) => fn()));
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

const report: SchoolReport = { id: 'r1', schoolId: 's1', reason: 'duplicate', createdAt: 1, status: 'open' };

function renderLayout(claims: AuthState['claims'] = { super: true }, signOut = vi.fn().mockResolvedValue(undefined), setLang = vi.fn()) {
  const auth: AuthState = { user: null, claims, loading: false, refreshClaims: async () => claims, signOut };
  renderWithSchool(
    <AuthContextProvider value={auth}>
      <LangContextProvider value={{ lang: 'en', setLang }}>
        <Routes>
          <Route
            path="*"
            element={
              <SuperLayout openReports={{ data: [report], loading: false }}>
                <Where />
              </SuperLayout>
            }
          />
        </Routes>
      </LangContextProvider>
    </AuthContextProvider>,
    { ctx, claims: claims ?? {}, route: '/super' },
  );
  return { signOut, setLang };
}

beforeEach(() => {
  width = 375;
  listeners.clear();
  window.matchMedia = vi.fn((query: string) => {
    const max = Number(/max-width:\s*([\d.]+)px/.exec(query)?.[1] ?? Infinity);
    return {
      get matches() {
        return width <= max;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    } as unknown as MediaQueryList;
  });
});
afterEach(() => {
  window.matchMedia = original;
});

describe('super admin phone menu', () => {
  it('opens from the top bar, lists every page with the report count, and closes on navigation', async () => {
    const user = userEvent.setup();
    renderLayout();
    const open = screen.getByRole('button', { name: 'Open menu' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await user.click(open);
    const menu = screen.getByRole('dialog', { name: 'Sathiya' });
    const nav = within(menu).getByRole('navigation', { name: 'Super admin menu' });
    expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/super',
      '/super/reports',
      '/super/usage',
      '/super/subjects',
      '/super/terms',
      '/super/announcements',
    ]);
    expect(within(nav).getByRole('link', { name: 'Schools' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Reports/ })).toHaveTextContent('1');
    expect(within(menu).queryByRole('link', { name: 'School admin' })).toBeNull();

    await user.click(within(nav).getByRole('link', { name: 'Usage' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/super/usage');
    expect(screen.queryByRole('dialog', { name: 'Sathiya' })).toBeNull();
  });

  it('switches language, signs out and links to school admin from the menu', async () => {
    const user = userEvent.setup();
    const { signOut, setLang } = renderLayout({ schools: { s: { r: 'a' } }, super: true });
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('dialog', { name: 'Sathiya' });
    expect(within(menu).getByRole('link', { name: 'School admin' })).toHaveAttribute('href', '/s/s/admin');
    await user.click(within(menu).getByRole('button', { name: 'Language: සිංහල' }));
    expect(setLang).toHaveBeenCalledWith('si');
    await user.click(within(menu).getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('closes when the screen grows past phone width', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Sathiya' })).toBeInTheDocument();
    resize(1024);
    expect(screen.queryByRole('dialog', { name: 'Sathiya' })).toBeNull();
  });
});

describe('review cards on a phone', () => {
  const pending: School = { ...ctx.school, status: 'pending', review: { moeMatched: false } };
  const empty = { data: [], loading: false };
  const buttonNames = (region: HTMLElement) => within(region).getAllByRole('button').map((b) => b.textContent);

  it('puts Approve first and below the registration details', () => {
    renderWithSchool(<ReviewSection school={pending} schools={empty} members={empty} review={vi.fn()} />, { ctx, claims: { super: true } });
    const card = screen.getByRole('region', { name: 'Review' });
    expect(buttonNames(card)).toEqual(['Approve school', 'Reject…']);
    expect(within(card).getByText('Registered by').compareDocumentPosition(within(card).getByRole('button', { name: 'Approve school' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('keeps Reject first on desktop', () => {
    width = 1024;
    renderWithSchool(<ReviewSection school={pending} schools={empty} members={empty} review={vi.fn()} />, { ctx, claims: { super: true } });
    expect(buttonNames(screen.getByRole('region', { name: 'Review' }))).toEqual(['Reject…', 'Approve school']);
  });

  it('puts Approve new name first on the name change card', () => {
    const change = { nameEn: 'New name', status: 'pending' as const, requestedAt: 1, requestedBy: 'u' };
    renderWithSchool(<NameChangeSection school={ctx.school} change={change} decide={vi.fn()} />, { ctx, claims: { super: true } });
    expect(buttonNames(screen.getByRole('region', { name: 'Name change' }))).toEqual(['Approve new name', 'Reject…']);
  });
});

describe('phone lists', () => {
  const make = (id: string, over: Partial<School>): School => ({ ...ctx.school, id, ...over });
  const list: School[] = [
    make('a', { nameEn: 'Siripura Central College', district: 'Kandy', status: 'active' }),
    make('b', { nameEn: 'Wattegama M.V.', district: 'Kandy', status: 'pending', censusNo: '99001' }),
    make('c', { nameEn: 'Hill View', district: 'Galle', status: 'disabled' }),
  ];
  const source: UsageSource = { counts: async () => ({ teachers: 1, classes: 2, entries: 3, lastActivity: null }) };
  const opts = { ctx, claims: { super: true } };

  it('groups schools by status with one action per row', async () => {
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolsPage schools={{ data: list, loading: false }} setStatus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect(screen.queryByRole('table')).toBeNull();
    const review = screen.getByRole('region', { name: /Needs review/ });
    expect(within(review).getByRole('button', { name: 'Review: Wattegama M.V.' })).toBeInTheDocument();
    const active = screen.getByRole('region', { name: /Active/ });
    expect(within(active).getByRole('button', { name: 'Open: Siripura Central College' })).toBeInTheDocument();
    expect(await within(active).findByText('Kandy · 1 teacher · 2 classes')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /Disabled/ })).getByText('Hill View')).toBeInTheDocument();
  });

  it('keeps disable and release under ⋯ on the school page', async () => {
    const user = userEvent.setup();
    renderWithSchool(
      <UsageSourceProvider value={source}>
        <SchoolDetail school={{ loading: false, data: { ...list[0]!, censusNo: '03021' } }} setStatus={vi.fn()} releaseCensus={vi.fn()} />
      </UsageSourceProvider>,
      opts,
    );
    expect(screen.queryByRole('button', { name: 'Disable' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Disable', 'Release census number']);
    await user.click(screen.getByRole('menuitem', { name: 'Disable' }));
    expect(screen.getByRole('dialog', { name: /Disable/ })).toBeInTheDocument();
  });

  it('opens a report as a sheet and closes it from the row', async () => {
    const user = userEvent.setup();
    const writer = { closeReport: vi.fn().mockResolvedValue(undefined) };
    renderWithSchool(
      <ReportsPage
        reports={{ data: [{ ...report, schoolId: 'a', details: 'Second account' }], loading: false }}
        schools={{ data: list, loading: false }}
        writer={writer}
        setStatus={vi.fn()}
        releaseCensus={vi.fn()}
      />,
      opts,
    );
    await user.click(screen.getByRole('button', { name: /^Siripura Central College/ }));
    const sheet = screen.getByRole('dialog', { name: 'Siripura Central College' });
    expect(within(sheet).getByText('Second account')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Suspend school' })).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Close: Siripura Central College' }));
    expect(writer.closeReport).toHaveBeenCalledWith('r1');
  });

  it('edits a default subject from its row and deletes it from the sheet', async () => {
    const user = userEvent.setup();
    const writer: PlatformWriter = { saveDefaultSubjects: vi.fn().mockResolvedValue(undefined), saveAnnouncement: vi.fn(), publishTerms: vi.fn() };
    const subjects = [
      { nameEn: 'Art', nameSi: 'චිත්‍ර', short: 'Art', color: '#EBDDF2' },
      { nameEn: 'Music', nameSi: 'සංගීතය', short: 'Mus', color: '#EBDDF2' },
    ];
    renderWithSchool(<DefaultSubjectsPage doc={{ loading: false, data: { subjects, updatedAt: 1 } }} writer={writer} />, opts);
    expect(screen.getByRole('region', { name: /Subjects/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Art' }));
    await user.click(screen.getByRole('button', { name: 'Delete Art' }));
    await user.click(screen.getByRole('button', { name: 'Delete subject' }));
    expect(writer.saveDefaultSubjects).toHaveBeenCalledWith(expect.objectContaining({ subjects: [subjects[1]] }));
  });
});
