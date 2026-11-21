import { screen } from '@testing-library/react';
import { MemoryRouter, Outlet, useLocation, useRoutes, type RouteObject } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';

const state = vi.hoisted(() => ({ claims: {} as Record<string, unknown>, user: null as unknown }));

vi.mock('../lib/firebase', () => ({ app: {}, auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock('./AuthProvider', () => ({
  useAuth: () => ({ user: state.user, claims: state.claims, loading: false }),
}));
vi.mock('./SchoolProvider', () => ({
  SchoolProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="school">{children}</div>,
}));
vi.mock('../ui/AdminLayout', () => ({
  AdminLayout: ({ basePath }: { basePath?: string }) => (
    <div data-testid="admin-layout" data-base={basePath ?? ''}>
      <Outlet />
    </div>
  ),
}));

const { buildRoutes, featureRoutesFrom } = await import('./router');

const fakeModules = {
  '../features/fake/routes.tsx': {
    routes: [
      { path: '/admin/teachers', element: <p>teachers screen</p> },
      { path: '/me', element: <p>my timetable</p> },
      { path: '/login', element: <p>login screen</p> },
      { path: '/super', element: <p>schools list</p> },
      { path: '/s/:sid/teachers', element: <p>school teachers</p> },
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
  it('collects routes from feature modules (named and default exports)', () => {
    const paths = featureRoutesFrom(fakeModules).map((r) => r.path);
    expect(paths).toEqual(['/admin/teachers', '/me', '/login', '/super', '/s/:sid/teachers', '/admin']);
  });

  it('nests /admin routes under the admin layout', () => {
    state.user = { uid: 'u' };
    state.claims = { sid: 's1', role: 'admin' };
    renderAt('/admin/teachers');
    expect(screen.getByTestId('admin-layout')).toContainElement(screen.getByText('teachers screen'));
  });

  it('guards admin routes', async () => {
    state.user = null;
    state.claims = {};
    renderAt('/admin');
    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(pathname()).toBe('/login');
  });

  it('puts /me under the school provider without the admin layout', () => {
    state.user = { uid: 'u' };
    state.claims = { sid: 's1', role: 'teacher', tid: 't1' };
    renderAt('/me');
    expect(screen.getByTestId('school')).toContainElement(screen.getByText('my timetable'));
    expect(screen.queryByTestId('admin-layout')).not.toBeInTheDocument();
  });

  it('renders super school views in a read-only admin layout', () => {
    state.user = { uid: 'u' };
    state.claims = { super: true };
    renderAt('/s/abc/teachers');
    const layout = screen.getByTestId('admin-layout');
    expect(layout).toHaveAttribute('data-base', '/s/abc');
    expect(layout).toContainElement(screen.getByText('school teachers'));
  });

  it.each([
    [{ sid: 's1', role: 'admin' }, '/admin', 'dashboard'],
    [{ sid: 's1', role: 'teacher', tid: 't' }, '/me', 'my timetable'],
    [{ super: true }, '/super', 'schools list'],
  ])('redirects / for %j to %s', async (claims, path, text) => {
    state.user = { uid: 'u' };
    state.claims = claims;
    renderAt('/');
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(pathname()).toBe(path);
  });

  it('redirects / to /login when signed out', async () => {
    state.user = null;
    state.claims = {};
    renderAt('/');
    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(pathname()).toBe('/login');
  });

  it('shows a not-found page', () => {
    renderAt('/nope');
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('builds with zero feature routes', () => {
    expect(() => buildRoutes([])).not.toThrow();
  });
});
