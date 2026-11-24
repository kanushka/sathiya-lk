// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { isSchoolAdmin, teacherIdOf, type Claims } from '@sathiya/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { LoadingState } from '../ui/LoadingState';
import { useAuth } from './AuthProvider';

export type Role = 'admin' | 'teacher' | 'super';

export function hasRole(claims: Claims, role: Role, sid?: string): boolean {
  if (role === 'super') return claims.super === true;
  if (!sid) return false;
  if (role === 'admin') return isSchoolAdmin(claims, sid);
  return !!teacherIdOf(claims, sid);
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, claims, loading } = useAuth();
  const { sid } = useParams();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!hasRole(claims, role, sid)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
