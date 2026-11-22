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

function renderAt(role: 'admin' | 'teacher' | 'super') {
  renderWithI18n(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>home</p>} />
        <Route path="/protected" element={<RequireRole role={role}><p>secret</p></RequireRole>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('redirects unauthenticated users to /login', () => {
    state.auth = { user: null, claims: {}, loading: false };
    renderAt('admin');
    expect(screen.getByText('login page from /protected')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('sends signed-out visitors of teacher routes to the teacher tab', () => {
    state.auth = { user: null, claims: {}, loading: false };
    renderAt('teacher');
    expect(screen.getByText('login page from /protected')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?as=teacher');
  });

  it('keeps the admin tab for admin routes', () => {
    state.auth = { user: null, claims: {}, loading: false };
    renderAt('admin');
    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });

  it('shows a loading state while auth resolves', () => {
    state.auth = { user: null, claims: {}, loading: true };
    renderAt('admin');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it.each<[Claims, 'admin' | 'teacher' | 'super', boolean]>([
    [{ sid: 's', role: 'admin' }, 'admin', true],
    [{ sid: 's', role: 'teacher', tid: 't' }, 'admin', false],
    [{ sid: 's', role: 'teacher', tid: 't' }, 'teacher', true],
    [{ sid: 's', role: 'admin', tid: 't' }, 'teacher', true],
    [{ sid: 's', role: 'admin' }, 'teacher', false],
    [{ super: true }, 'super', true],
    [{ sid: 's', role: 'admin' }, 'super', false],
    [{}, 'admin', false],
  ])('claims %j for %s → allowed %s', (claims, role, allowed) => {
    state.auth = { user: { uid: 'u' }, claims, loading: false };
    renderAt(role);
    expect(screen.queryByText('secret') !== null).toBe(allowed);
    expect(screen.queryByText('home') !== null).toBe(!allowed);
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });
});
