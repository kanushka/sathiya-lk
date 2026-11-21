// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { isValidElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase', () => ({ app: {}, auth: {}, db: {}, functions: {}, storage: {} }));

const { buildRoutes, collectFeatureRoutes } = await import('./router');
const { RequireRole } = await import('./RequireRole');

interface Leaf {
  full: string;
  role: string | null;
}

function leaves(routes: RouteObject[], parent = '', role: string | null = null): Leaf[] {
  return routes.flatMap((r) => {
    const own = isValidElement(r.element) && r.element.type === RequireRole ? String((r.element.props as { role: string }).role) : role;
    const full = r.path === undefined ? parent : r.path.startsWith('/') ? r.path : `${parent}/${r.path}`;
    if (r.children) return leaves(r.children, full, own);
    return [{ full, role: own }];
  });
}

const all = leaves(buildRoutes(collectFeatureRoutes()));

describe('registered routes', () => {
  it('has no duplicate full paths', () => {
    const seen = new Map<string, number>();
    for (const { full } of all) seen.set(full, (seen.get(full) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([p]) => p)).toEqual([]);
  });

  it.each([
    ['/admin', 'admin'],
    ['/me', 'teacher'],
    ['/super', 'super'],
    ['/s/:sid', 'super'],
  ])('guards every %s path with the %s role', (prefix, role) => {
    const matching = all.filter(({ full }) => full === prefix || full.startsWith(`${prefix}/`));
    expect(matching.length).toBeGreaterThan(0);
    expect(matching.filter((l) => l.role !== role).map((l) => l.full)).toEqual([]);
  });

  it('mirrors admin and print routes under /s/:sid', () => {
    const paths = new Set(all.map((l) => l.full));
    for (const p of ['/admin', '/admin/teachers', '/admin/print/class/:id', '/admin/print/teacher/:id']) {
      expect(paths.has(p)).toBe(true);
      expect(paths.has(p.replace('/admin', '/s/:sid'))).toBe(true);
    }
  });

  it('leaves the public routes unguarded', () => {
    const open = all.filter((l) => l.role === null).map((l) => l.full).sort();
    expect(open).toEqual(['/', '/*', '/auth/action', '/login', '/register']);
  });
});
