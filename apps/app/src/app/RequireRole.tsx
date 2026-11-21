import type { Claims } from '@sathiya/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../ui/LoadingState';
import { useAuth } from './AuthProvider';

export type Role = 'admin' | 'teacher' | 'super';

export function hasRole(claims: Claims, role: Role): boolean {
  if (role === 'super') return claims.super === true;
  if (role === 'admin') return claims.role === 'admin';
  return claims.role === 'teacher' || (claims.role === 'admin' && !!claims.tid);
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, claims, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user || !hasRole(claims, role)) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}
