import type { Claims } from '@sathiya/core';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';

const state = vi.hoisted(() => ({ auth: { user: null as unknown, claims: {} as Claims, loading: false } }));
vi.mock('./AuthProvider', () => ({ useAuth: () => state.auth }));

const { RequireRole } = await import('./RequireRole');

function renderAt(role: 'admin' | 'teacher' | 'super') {
  renderWithI18n(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/protected" element={<RequireRole role={role}><p>secret</p></RequireRole>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('redirects unauthenticated users to /login', () => {
    state.auth = { user: null, claims: {}, loading: false };
    renderAt('admin');
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
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
  ])('claims %j for %s → allowed %s', (claims, role, allowed) => {
    state.auth = { user: { uid: 'u' }, claims, loading: false };
    renderAt(role);
    expect(screen.queryByText('secret') !== null).toBe(allowed);
    expect(screen.queryByText('login page') !== null).toBe(!allowed);
  });
});
