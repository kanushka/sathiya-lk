// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, useRoutes, type RouteObject } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { PHONE_NOTICE_KEY } from './PhoneNotice';

const state = vi.hoisted(() => ({ claims: {} as Record<string, unknown> }));

vi.mock('../lib/firebase', () => ({ app: {}, auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock('../app/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'u' }, claims: state.claims, loading: false }),
}));
vi.mock('../app/SchoolProvider', () => ({
  SchoolProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./AdminLayout', () => ({ AdminLayout: () => <Outlet /> }));

const { buildRoutes } = await import('../app/router');

let width = 375;
const listeners = new Set<() => void>();

function installMatchMedia() {
  window.matchMedia = vi.fn((query: string) => {
    const max = Number(/max-width:\s*([\d.]+)px/.exec(query)?.[1] ?? Infinity);
    return {
      get matches() {
        return width <= max;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  });
}

function resize(w: number) {
  width = w;
  act(() => listeners.forEach((fn) => fn()));
}

const routes = buildRoutes([
  { path: '/admin', element: <p>dashboard</p> },
  { path: '/admin/print/class/:id', element: <p>print class</p> },
  { path: '/me', element: <p>my timetable</p> },
  { path: '/super', element: <p>schools list</p> },
  { path: '/admin/teachers', element: <p>school teachers</p> },
  { path: '/login', element: <p>login screen</p> },
  { path: '/register', element: <p>register screen</p> },
  { path: '/auth/action', element: <p>auth action</p> },
] satisfies RouteObject[]);

function App() {
  return useRoutes(routes);
}

function renderAt(path: string) {
  renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const dialog = () => screen.queryByRole('dialog', { name: 'Best on a bigger screen' });
const banner = () => screen.queryByText('Admin screens work best on a laptop, desktop or tablet.');

describe('PhoneNotice', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    width = 375;
    listeners.clear();
    installMatchMedia();
    state.claims = { schools: { s1: { r: 'a', t: 't1' } }, super: true };
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('is hidden for school admins on /s/s1/admin at 375px', () => {
    renderAt('/s/s1/admin');
    expect(dialog()).toBeNull();
    expect(banner()).toBeNull();
  });

  it('shows a modal on /super at 375px', () => {
    renderAt('/super');
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue anyway' })).toBeInTheDocument();
  });

  it.each(['/super', '/super/schools/s1/admin/teachers'])('shows on %s at 375px', (path) => {
    renderAt(path);
    expect(dialog()).toBeInTheDocument();
  });

  it.each([768, 1024, 1440])('is hidden at %ipx', (w) => {
    width = w;
    renderAt('/super');
    expect(dialog()).toBeNull();
    expect(banner()).toBeNull();
  });

  it.each(['/s/s1/me', '/login', '/register', '/auth/action', '/s/s1/admin/print/class/c1'])('is hidden on %s', (path) => {
    renderAt(path);
    expect(dialog()).toBeNull();
    expect(banner()).toBeNull();
  });

  it('remembers dismissal and shows a banner instead', async () => {
    renderAt('/super');
    await userEvent.click(screen.getByRole('button', { name: 'Continue anyway' }));
    expect(dialog()).toBeNull();
    expect(banner()).toBeInTheDocument();
    expect(localStorage.getItem(PHONE_NOTICE_KEY)).toBe('1');
  });

  it('shows only the banner once dismissed', () => {
    localStorage.setItem(PHONE_NOTICE_KEY, '1');
    renderAt('/super');
    expect(dialog()).toBeNull();
    expect(banner()).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    renderAt('/super');
    await userEvent.keyboard('{Escape}');
    expect(dialog()).toBeNull();
    expect(localStorage.getItem(PHONE_NOTICE_KEY)).toBe('1');
  });

  it('reacts to resizes', () => {
    width = 1280;
    renderAt('/super');
    expect(dialog()).toBeNull();
    resize(375);
    expect(dialog()).toBeInTheDocument();
    resize(800);
    expect(dialog()).toBeNull();
  });

  it('survives blocked storage', async () => {
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderAt('/super');
    await userEvent.click(screen.getByRole('button', { name: 'Continue anyway' }));
    expect(banner()).toBeInTheDocument();
    get.mockRestore();
    set.mockRestore();
  });
});
