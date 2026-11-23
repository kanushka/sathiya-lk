// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Claims } from '@sathiya/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testI18n } from '../test/render';
import { ToastProvider } from '../ui/Toast';
import { LangContextProvider } from './LangProvider';

const state = vi.hoisted(() => ({
  claims: {} as Claims,
  status: 'disabled' as 'active' | 'disabled',
  schoolLoading: false,
  collections: [] as (string | null)[],
  signOut: vi.fn(async () => undefined),
}));

vi.mock('../lib/firebase', () => ({ app: {}, auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock('./AuthProvider', () => ({ useAuth: () => ({ claims: state.claims, signOut: state.signOut }) }));
vi.mock('../features/auth/api', () => ({ getDirectorySchool: vi.fn(async () => null), searchSchools: vi.fn(async () => []), reportSchool: vi.fn() }));
vi.mock('../lib/firestore', () => ({
  useDoc: (path: string | null) => {
    if (state.schoolLoading) return { loading: true };
    return path === 'schools/s1'
      ? { loading: false, data: { id: 's1', nameEn: 'Siripura', status: state.status, activeYearId: 'y1', colors: { primary: '#7A1F3D', second: '#D9A441' } } }
      : { loading: false };
  },
  useCollection: (path: string | null) => {
    state.collections.push(path);
    return { loading: false, data: [] };
  },
}));

const { SchoolProvider } = await import('./SchoolProvider');

function renderProvider(scope?: 'full' | 'school', sid?: string) {
  const lang = { lang: 'en' as const, setLang: () => undefined };
  return render(
    <MemoryRouter>
      <LangContextProvider value={lang}>
        <I18nextProvider i18n={testI18n}>
          <ToastProvider>
            <SchoolProvider scope={scope} sid={sid}>
              <p>dashboard</p>
            </SchoolProvider>
          </ToastProvider>
        </I18nextProvider>
      </LangContextProvider>
    </MemoryRouter>,
  );
}

describe('suspended school gate', () => {
  beforeEach(() => {
    state.status = 'disabled';
    state.schoolLoading = false;
    state.collections.length = 0;
    state.signOut.mockClear();
  });

  it('shows the suspended screen to an admin instead of the dashboard, without subscribing school data', () => {
    state.claims = { sid: 's1', role: 'admin' };
    renderProvider();
    expect(screen.getByRole('heading', { name: 'This school is suspended' })).toBeInTheDocument();
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
    expect(state.collections.every((p) => p === null)).toBe(true);
  });

  it('shows the suspended screen to a teacher', () => {
    state.claims = { sid: 's1', role: 'teacher', tid: 't1' };
    renderProvider('school');
    expect(screen.getByRole('heading', { name: 'This school is suspended' })).toBeInTheDocument();
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
  });

  it('offers contact, report and sign out', async () => {
    state.claims = { sid: 's1', role: 'admin' };
    renderProvider();
    expect(screen.getByRole('link', { name: 'Contact the Sathiya team' })).toHaveAttribute('href', 'https://sathiya.kanushka.com/contact/');
    await userEvent.click(screen.getByRole('button', { name: 'Report a problem' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(state.signOut).toHaveBeenCalled();
  });

  it('never blocks a super admin', () => {
    state.claims = { super: true };
    renderProvider('full', 's1');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'This school is suspended' })).not.toBeInTheDocument();
  });

  it('lets an admin of an active school through', () => {
    state.claims = { sid: 's1', role: 'admin' };
    state.status = 'active';
    renderProvider();
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('opens no school data listeners until the school doc has loaded', () => {
    state.claims = { sid: 's1', role: 'admin' };
    state.status = 'active';
    state.schoolLoading = true;
    renderProvider();
    expect(state.collections.length).toBeGreaterThan(0);
    expect(state.collections.every((p) => p === null)).toBe(true);
  });

  it('subscribes school data for a super admin viewing a suspended school', () => {
    state.claims = { super: true };
    renderProvider('full', 's1');
    expect(state.collections).toContain('schools/s1/teachers');
  });
});
