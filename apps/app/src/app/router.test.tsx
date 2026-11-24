// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation, useParams, useRoutes, type RouteObject } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';

const state = vi.hoisted(() => ({ claims: {} as Record<string, unknown>, user: null as unknown }));

vi.mock('../lib/firebase', () => ({ app: {}, auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock('./AuthProvider', () => ({
  useAuth: () => ({ user: state.user, claims: state.claims, loading: false }),
}));
vi.mock('./SchoolProvider', async () => {
  const { useParams } = await import('react-router-dom');
  return {
    SchoolProvider: ({ children, scope }: { children: React.ReactNode; scope?: string }) => (
      <div data-testid="school" data-scope={scope ?? 'full'} data-sid={useParams().sid ?? ''}>
        {children}
      </div>
    ),
  };
});
vi.mock('../ui/AdminLayout', () => ({
  AdminLayout: ({ basePath, readOnly }: { basePath?: string; readOnly?: boolean }) => (
    <div data-testid="admin-layout" data-base={basePath ?? ''} data-readonly={String(!!readOnly)}>
      <Outlet />
    </div>
  ),
}));

const { buildRoutes, featureRoutesFrom } = await import('./router');

function ClassPage() {
  const { id } = useParams();
  return <p>class {id}</p>;
}

const fakeModules = {
  '../features/fake/routes.tsx': {
    routes: [
      { path: '/admin/teachers', element: <p>teachers screen</p> },
      { path: '/me', element: <p>my timetable</p> },
      { path: '/login', element: <p>login screen</p> },
      { path: '/super', element: <p>schools list</p> },
      { path: '/admin/classes/:id', element: <ClassPage /> },
      { path: '/admin/print/class/:id', element: <p>print class</p> },
      { path: '/register', element: <p>register screen</p> },
      { path: '/start', element: <p>start screen</p> },
      { path: '/super/schools/:sid', element: <p>school detail</p> },
    ] satisfies RouteObject[],
  },
  '../features/other/routes.tsx': {
    default: [{ path: '/admin', element: <p>dashboard</p> }] satisfies RouteObject[],
  },
};

// useRoutes instead of a data router: jsdom's AbortSignal is rejected by Node's fetch Request.
function App({ routes }: { routes: RouteObject[] }) {
  const location = useLocation();
  return (
    <>
      <output data-testid="path">{location.pathname}</output>
      {useRoutes(routes)}
    </>
  );
}

function renderAt(path: string) {
  renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <App routes={buildRoutes(featureRoutesFrom(fakeModules))} />
    </MemoryRouter>,
  );
}

const pathname = () => screen.getByTestId('path').textContent;

describe('router', () => {
  beforeEach(() => localStorage.clear());

  it('guards a feature route written without the leading slash', async () => {
    state.user = null;
    state.claims = {};
    renderWithI18n(
      <MemoryRouter initialEntries={['/s/s1/admin/subjects']}>
        <App routes={buildRoutes([{ path: 'admin/subjects', element: <p>subjects screen</p> }, { path: '/login', element: <p>login screen</p> }])} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(screen.queryByText('subjects screen')).toBeNull();
  });

  it('collects routes from feature modules (named and default exports)', () => {
    const paths = featureRoutesFrom(fakeModules).map((r) => r.path);
    expect(paths).toEqual([
      '/admin/teachers',
      '/me',
      '/login',
      '/super',
      '/admin/classes/:id',
      '/admin/print/class/:id',
      '/register',
      '/start',
      '/super/schools/:sid',
      '/admin',
    ]);
  });

  it('nests admin routes under /s/:sid/admin with the admin layout', () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 'a' } } };
    renderAt('/s/s1/admin/teachers');
    const layout = screen.getByTestId('admin-layout');
    expect(layout).toHaveAttribute('data-base', '/s/s1/admin');
    expect(layout).toHaveAttribute('data-readonly', 'false');
    expect(layout).toContainElement(screen.getByText('teachers screen'));
    expect(screen.getByTestId('school')).toHaveAttribute('data-sid', 's1');
  });

  it('renders the admin index at /s/:sid/admin', () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 'a' } } };
    renderAt('/s/s1/admin');
    expect(screen.getByTestId('admin-layout')).toContainElement(screen.getByText('dashboard'));
  });

  it('guards admin routes', async () => {
    state.user = null;
    state.claims = {};
    renderAt('/s/s1/admin');
    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(pathname()).toBe('/login');
  });

  it('does not let an admin of one school into another', async () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 'a' } } };
    renderAt('/s/s2/admin/teachers');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(pathname()).toBe('/s/s1/admin');
  });

  it('puts /s/:sid/me under the school provider without the admin layout', () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 't', t: 't1' } } };
    renderAt('/s/s1/me');
    expect(screen.getByTestId('school')).toContainElement(screen.getByText('my timetable'));
    expect(screen.getByTestId('school')).toHaveAttribute('data-scope', 'school');
    expect(screen.queryByTestId('admin-layout')).not.toBeInTheDocument();
  });

  it('remembers the school a member opens', () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 't', t: 't1' }, s2: { r: 'a' } } };
    renderAt('/s/s2/admin');
    expect(localStorage.getItem('sathiya.lastSchool')).toBe('s2');
  });

  it('sends /s/:sid to that school home for the role', async () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 't', t: 't1' } } };
    renderAt('/s/s1');
    expect(await screen.findByText('my timetable')).toBeInTheDocument();
    expect(pathname()).toBe('/s/s1/me');
  });

  it.each([
    [{ schools: { s1: { r: 'a' } } }, '/s/s1/admin', 'dashboard'],
    [{ schools: { s1: { r: 't', t: 't' } } }, '/s/s1/me', 'my timetable'],
    [{ super: true }, '/super', 'schools list'],
    [{}, '/start', 'start screen'],
  ])('redirects / for %j to %s', async (claims, path, text) => {
    state.user = { uid: 'u' };
    state.claims = claims;
    renderAt('/');
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(pathname()).toBe(path);
  });

  it('redirects / to the last-used school while still a member', async () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 'a' }, s2: { r: 't', t: 't2' } } };
    localStorage.setItem('sathiya.lastSchool', 's2');
    renderAt('/');
    expect(await screen.findByText('my timetable')).toBeInTheDocument();
    expect(pathname()).toBe('/s/s2/me');
  });

  it('falls back to the first school when the last-used one is gone', async () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 'a' }, s2: { r: 't', t: 't2' } } };
    localStorage.setItem('sathiya.lastSchool', 'gone');
    renderAt('/');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(pathname()).toBe('/s/s1/admin');
  });

  it('redirects / to /login when signed out', async () => {
    state.user = null;
    state.claims = {};
    renderAt('/');
    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(pathname()).toBe('/login');
  });

  it('sends a teacher away from admin pages to their home', async () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 't', t: 't' } } };
    renderAt('/s/s1/admin/teachers');
    expect(await screen.findByText('my timetable')).toBeInTheDocument();
    expect(pathname()).toBe('/s/s1/me');
  });

  it('sends old /admin and /me links home', async () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 'a' } } };
    renderAt('/admin/teachers');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(pathname()).toBe('/s/s1/admin');
  });

  it('mirrors every admin route to /super/schools/:sid/admin under the read-only layout', () => {
    state.user = { uid: 'u' };
    state.claims = { super: true };
    renderAt('/super/schools/abc/admin/classes/c9');
    const layout = screen.getByTestId('admin-layout');
    expect(layout).toHaveAttribute('data-base', '/super/schools/abc/admin');
    expect(layout).toHaveAttribute('data-readonly', 'true');
    expect(layout).toContainElement(screen.getByText('class c9'));
    expect(screen.getByTestId('school')).toHaveAttribute('data-sid', 'abc');
  });

  it('keeps the super school detail page at /super/schools/:sid', () => {
    state.user = { uid: 'u' };
    state.claims = { super: true };
    renderAt('/super/schools/abc');
    expect(screen.getByText('school detail')).toBeInTheDocument();
  });

  it('mirrors the admin index for super', () => {
    state.user = { uid: 'u' };
    state.claims = { super: true };
    renderAt('/super/schools/abc/admin');
    expect(screen.getByTestId('admin-layout')).toContainElement(screen.getByText('dashboard'));
  });

  it('does not expose mirrored routes to admins', async () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 'a' } } };
    renderAt('/super/schools/abc/admin/classes/c9');
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
    expect(pathname()).toBe('/s/s1/admin');
  });

  it('renders print routes under the school provider without the admin shell', () => {
    state.user = { uid: 'u' };
    state.claims = { schools: { s1: { r: 'a' } } };
    renderAt('/s/s1/admin/print/class/c1');
    expect(screen.getByTestId('school')).toContainElement(screen.getByText('print class'));
    expect(screen.getByTestId('school')).toHaveAttribute('data-scope', 'full');
    expect(screen.getByTestId('school')).toHaveAttribute('data-sid', 's1');
    expect(screen.queryByTestId('admin-layout')).not.toBeInTheDocument();
  });

  it('guards print routes by the admin role', async () => {
    state.user = null;
    state.claims = {};
    renderAt('/s/s1/admin/print/class/c1');
    expect(await screen.findByText('login screen')).toBeInTheDocument();
  });

  it('mirrors print routes for super without the admin shell', () => {
    state.user = { uid: 'u' };
    state.claims = { super: true };
    renderAt('/super/schools/abc/admin/print/class/c1');
    expect(screen.getByTestId('school')).toHaveAttribute('data-sid', 'abc');
    expect(screen.getByTestId('school')).toContainElement(screen.getByText('print class'));
    expect(screen.queryByTestId('admin-layout')).not.toBeInTheDocument();
  });

  it('shows a not-found page', () => {
    renderAt('/nope');
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('builds with zero feature routes', () => {
    expect(() => buildRoutes([])).not.toThrow();
  });
});
