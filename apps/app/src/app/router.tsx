import { useTranslation } from 'react-i18next';
import { Link, Navigate, Outlet, createBrowserRouter, useParams, type RouteObject } from 'react-router-dom';
import { AdminLayout } from '../ui/AdminLayout';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { useAuth } from './AuthProvider';
import { RequireRole, hasRole } from './RequireRole';
import { SchoolProvider } from './SchoolProvider';

export interface FeatureModule {
  routes?: RouteObject[];
  default?: RouteObject[];
}

export function featureRoutesFrom(modules: Record<string, FeatureModule>): RouteObject[] {
  return Object.keys(modules)
    .sort()
    .flatMap((key) => {
      const mod = modules[key];
      return mod?.routes ?? mod?.default ?? [];
    });
}

export function collectFeatureRoutes(): RouteObject[] {
  return featureRoutesFrom(import.meta.glob<FeatureModule>('../features/*/routes.tsx', { eager: true }));
}

function under(path: string | undefined, prefix: string): boolean {
  return path === prefix || (path?.startsWith(`${prefix}/`) ?? false);
}

export function HomeRedirect() {
  const { user, claims, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (hasRole(claims, 'admin')) return <Navigate to="/admin" replace />;
  if (hasRole(claims, 'teacher')) return <Navigate to="/me" replace />;
  if (hasRole(claims, 'super')) return <Navigate to="/super" replace />;
  return <Navigate to="/login" replace />;
}

export function NotFound() {
  const { t } = useTranslation('shell');
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4">
      <EmptyState
        icon="search"
        title={t('notFound.title')}
        body={t('notFound.body')}
        action={
          <Link to="/" className="font-semibold text-brand underline underline-offset-2">
            {t('notFound.home')}
          </Link>
        }
      />
    </div>
  );
}

function SuperSchoolLayout() {
  const { sid } = useParams();
  return (
    <SchoolProvider sid={sid}>
      <AdminLayout basePath={`/s/${sid ?? ''}`} readOnly />
    </SchoolProvider>
  );
}

export function buildRoutes(featureRoutes: RouteObject[]): RouteObject[] {
  const admin: RouteObject[] = [];
  const me: RouteObject[] = [];
  const superRoutes: RouteObject[] = [];
  const schoolView: RouteObject[] = [];
  const pub: RouteObject[] = [];

  for (const route of featureRoutes) {
    if (under(route.path, '/admin')) admin.push(route);
    else if (under(route.path, '/me')) me.push(route);
    else if (under(route.path, '/super')) superRoutes.push(route);
    else if (under(route.path, '/s/:sid')) schoolView.push(route);
    else pub.push(route);
  }

  return [
    { path: '/', element: <HomeRedirect /> },
    {
      element: (
        <RequireRole role="admin">
          <AdminLayout />
        </RequireRole>
      ),
      children: admin,
    },
    {
      element: (
        <RequireRole role="teacher">
          <SchoolProvider scope="school">
            <Outlet />
          </SchoolProvider>
        </RequireRole>
      ),
      children: me,
    },
    {
      element: (
        <RequireRole role="super">
          <Outlet />
        </RequireRole>
      ),
      children: superRoutes,
    },
    {
      path: '/s/:sid',
      element: (
        <RequireRole role="super">
          <SuperSchoolLayout />
        </RequireRole>
      ),
      children: schoolView,
    },
    ...pub,
    { path: '*', element: <NotFound /> },
  ];
}

export const router = createBrowserRouter(buildRoutes(collectFeatureRoutes()));
