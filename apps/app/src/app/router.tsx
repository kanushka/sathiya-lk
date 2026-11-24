// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { schoolIds } from '@sathiya/core';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, Outlet, createBrowserRouter, useParams, type RouteObject } from 'react-router-dom';
import { AdminLayout } from '../ui/AdminLayout';
import { EmptyState } from '../ui/EmptyState';
import { LoadingState } from '../ui/LoadingState';
import { PhoneNotice } from '../ui/PhoneNotice';
import { useAuth } from './AuthProvider';
import { RequireRole } from './RequireRole';
import { SchoolProvider } from './SchoolProvider';
import { useRefreshClaimsOnce } from './useRefreshClaimsOnce';
import { homePath, readLastSchool, rememberLastSchool, schoolHomePath } from './schoolHome';

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
  const noSchools = !loading && !!user && schoolIds(claims).length === 0;
  const refreshed = useRefreshClaimsOnce(noSchools);
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (noSchools && !refreshed) return <LoadingState />;
  return <Navigate to={homePath(claims, readLastSchool())} replace />;
}

export function SchoolHomeRedirect() {
  const { user, claims, loading } = useAuth();
  const { sid } = useParams();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={(sid && schoolHomePath(claims, sid)) || '/'} replace />;
}

function RememberSchool() {
  const { sid } = useParams();
  useEffect(() => {
    if (sid) rememberLastSchool(sid);
  }, [sid]);
  return null;
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
    <SchoolProvider>
      <AdminLayout basePath={`/super/schools/${sid ?? ''}/admin`} readOnly />
    </SchoolProvider>
  );
}

function MemberAdminLayout() {
  const { sid } = useParams();
  return (
    <SchoolProvider>
      <RememberSchool />
      <AdminLayout basePath={`/s/${sid ?? ''}/admin`} />
    </SchoolProvider>
  );
}

function rebase(route: RouteObject, from: string, to: string): RouteObject {
  const { id: _id, ...rest } = route;
  const path = route.path !== undefined && under(route.path, from) ? to + route.path.slice(from.length) : route.path;
  const children = route.children?.map((c) => rebase(c, from, to));
  return { ...rest, ...(path !== undefined && { path }), ...(children && { children }) } as RouteObject;
}

const SCHOOL_ADMIN = '/s/:sid/admin';
const SUPER_ADMIN = '/super/schools/:sid/admin';

export function buildRoutes(featureRoutes: RouteObject[]): RouteObject[] {
  const admin: RouteObject[] = [];
  const print: RouteObject[] = [];
  const me: RouteObject[] = [];
  const superRoutes: RouteObject[] = [];
  const pub: RouteObject[] = [];

  for (const raw of featureRoutes) {
    const route = raw.path !== undefined && !raw.path.startsWith('/') ? { ...raw, path: `/${raw.path}` } : raw;
    if (under(route.path, '/admin/print')) print.push(route);
    else if (under(route.path, '/admin')) admin.push(route);
    else if (under(route.path, '/me')) me.push(route);
    else if (under(route.path, '/super')) superRoutes.push(route);
    else pub.push(route);
  }

  return [
    { path: '/', element: <HomeRedirect /> },
    { path: '/admin/*', element: <Navigate to="/" replace /> },
    { path: '/me/*', element: <Navigate to="/" replace /> },
    { path: '/s/:sid', element: <SchoolHomeRedirect /> },
    {
      element: (
        <RequireRole role="admin">
          <MemberAdminLayout />
        </RequireRole>
      ),
      children: admin.map((r) => rebase(r, '/admin', SCHOOL_ADMIN)),
    },
    {
      element: (
        <RequireRole role="admin">
          <SchoolProvider>
            <RememberSchool />
            <Outlet />
          </SchoolProvider>
        </RequireRole>
      ),
      children: print.map((r) => rebase(r, '/admin', SCHOOL_ADMIN)),
    },
    {
      element: (
        <RequireRole role="teacher">
          <SchoolProvider scope="school">
            <RememberSchool />
            <Outlet />
          </SchoolProvider>
        </RequireRole>
      ),
      children: me.map((r) => rebase(r, '/me', '/s/:sid/me')),
    },
    {
      element: (
        <RequireRole role="super">
          <PhoneNotice />
          <Outlet />
        </RequireRole>
      ),
      children: superRoutes,
    },
    {
      element: (
        <RequireRole role="super">
          <PhoneNotice />
          <SuperSchoolLayout />
        </RequireRole>
      ),
      children: admin.map((r) => rebase(r, '/admin', SUPER_ADMIN)),
    },
    {
      element: (
        <RequireRole role="super">
          <SchoolProvider>
            <Outlet />
          </SchoolProvider>
        </RequireRole>
      ),
      children: print.map((r) => rebase(r, '/admin', SUPER_ADMIN)),
    },
    ...pub,
    { path: '*', element: <NotFound /> },
  ];
}

export const router = createBrowserRouter(buildRoutes(collectFeatureRoutes()));
