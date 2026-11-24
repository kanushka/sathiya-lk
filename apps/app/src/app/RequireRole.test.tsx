// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Claims } from '@sathiya/core';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';

const state = vi.hoisted(() => ({ auth: { user: null as unknown, claims: {} as Claims, loading: false } }));
vi.mock('./AuthProvider', () => ({ useAuth: () => state.auth }));

const { RequireRole } = await import('./RequireRole');

function LoginPage() {
  const from = (useLocation().state as { from?: { pathname: string } } | null)?.from?.pathname;
  const { search } = useLocation();
  return (
    <>
      <p>login page from {from}</p>
      <p data-testid="search">{search}</p>
    </>
  );
}

function renderAt(role: 'admin' | 'teacher' | 'super', at = '/s/s1/protected') {
  renderWithI18n(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>home</p>} />
        <Route path="/s/:sid/protected" element={<RequireRole role={role}><p>secret</p></RequireRole>} />
        <Route path="/protected" element={<RequireRole role={role}><p>secret</p></RequireRole>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('redirects unauthenticated users to /login', () => {
    state.auth = { user: null, claims: {}, loading: false };
    renderAt('admin');
    expect(screen.getByText('login page from /s/s1/protected')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('sends signed-out teachers to the same login page', () => {
    state.auth = { user: null, claims: {}, loading: false };
    renderAt('teacher');
    expect(screen.getByText('login page from /s/s1/protected')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });

  it('shows a loading state while auth resolves', () => {
    state.auth = { user: null, claims: {}, loading: true };
    renderAt('admin');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it.each<[Claims, 'admin' | 'teacher' | 'super', boolean]>([
    [{ schools: { s1: { r: 'a' } } }, 'admin', true],
    [{ schools: { s2: { r: 'a' } } }, 'admin', false],
    [{ schools: { s1: { r: 't', t: 't' } } }, 'admin', false],
    [{ schools: { s1: { r: 't', t: 't' } } }, 'teacher', true],
    [{ schools: { s2: { r: 't', t: 't' } } }, 'teacher', false],
    [{ schools: { s1: { r: 'a', t: 't' } } }, 'teacher', true],
    [{ schools: { s1: { r: 'a' } } }, 'teacher', false],
    [{ schools: { s1: { r: 't' } } }, 'teacher', false],
    [{ super: true }, 'super', true],
    [{ super: true }, 'admin', false],
    [{ schools: { s1: { r: 'a' } } }, 'super', false],
    [{}, 'admin', false],
  ])('claims %j for %s at school s1 → allowed %s', (claims, role, allowed) => {
    state.auth = { user: { uid: 'u' }, claims, loading: false };
    renderAt(role);
    expect(screen.queryByText('secret') !== null).toBe(allowed);
    expect(screen.queryByText('home') !== null).toBe(!allowed);
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });

  it('denies school roles on a route without a school', () => {
    state.auth = { user: { uid: 'u' }, claims: { schools: { s1: { r: 'a' } } }, loading: false };
    renderAt('admin', '/protected');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('home')).toBeInTheDocument();
  });
});
