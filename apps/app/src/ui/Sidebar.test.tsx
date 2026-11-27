// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Claims, Year } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickOption } from '../test/pickOption';
import { renderWithSchool } from '../test/renderWithSchool';
import { Sidebar, navItems } from './Sidebar';

const join = vi.hoisted(() => ({ count: 0, sid: null as string | null }));
vi.mock('../features/teachers/useJoinRequests', () => ({
  useJoinRequests: (sid: string | null) => {
    join.sid = sid;
    return { data: sid ? Array.from({ length: join.count }, (_, i) => ({ id: `u${i}` })) : [], loading: false };
  },
}));

vi.mock('../app/memberSchools', () => ({
  fetchSchoolNames: async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id === 'siripura' ? 'Siripura Central College' : 'Royal College'])),
}));

const twoYears: Year[] = [
  { id: 'y27', label: '2027', status: 'draft' },
  { id: 'y26', label: '2026', status: 'published' },
];

function renderSidebar(path = '/s/siripura/admin/teachers', opts: { years?: Year[]; claims?: Claims } = {}) {
  return renderWithSchool(<Sidebar />, { ctx, years: opts.years ?? twoYears, route: path, ...(opts.claims && { claims: opts.claims }) });
}

describe('Sidebar', () => {
  it('shows the year heading as plain text when there are no years', () => {
    renderSidebar('/s/siripura/admin/teachers', { years: [] });
    expect(screen.getByText('No years yet')).toBeInTheDocument();
    expect(screen.getByText('Timetable year').tagName).toBe('P');
    expect(document.querySelector('label[for]')).toBeNull();
  });

  it('shows only the school name when no logo was uploaded', () => {
    renderSidebar();
    expect(screen.getByText('Siripura Central College')).toBeInTheDocument();
    expect(screen.queryByTestId('school-logo')).toBeNull();
    expect(document.querySelector('nav svg text')).toBeNull();
  });

  it('shows the uploaded logo', () => {
    renderWithSchool(<Sidebar />, { ctx: { ...ctx, school: { ...ctx.school, logoUrl: 'https://example.test/logo.png' } }, years: twoYears, route: '/s/siripura/admin' });
    expect(screen.getByTestId('school-logo')).toHaveAttribute('src', 'https://example.test/logo.png');
  });

  it('links to the website guides in a new tab', () => {
    renderSidebar();
    const link = screen.getByRole('link', { name: 'Help & guides (opens in a new tab)' });
    expect(link).toHaveAttribute('href', expect.stringMatching(/\/guide\/$/));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('lists the admin nav paths', () => {
    expect(navItems.map((i) => i.path)).toEqual([
      '/admin',
      '/admin/timetable/class',
      '/admin/timetable/teacher',
      '/admin/relief',
      '/admin/teachers',
      '/admin/subjects',
      '/admin/grades',
      '/admin/templates',
      '/admin/members',
      '/admin/profile',
    ]);
  });

  it('switches the selected year', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await pickOption(user, screen.getByLabelText('Timetable year'), '2026 · published');
    expect(screen.getByLabelText('Timetable year')).toHaveTextContent('2026 · published');
  });

  it('shows school name, year select and active link', async () => {
    const user = userEvent.setup();
    renderSidebar();
    expect(screen.getByText('Siripura Central College')).toBeInTheDocument();
    const year = screen.getByLabelText('Timetable year');
    expect(year).toHaveTextContent('2027 · draft');
    await user.click(year);
    expect(screen.getByRole('option', { name: '2026 · published' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teachers' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('collapses to the icon rail and persists the choice', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(localStorage.getItem('sathiya.sidebar')).toBe('collapsed');
    expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByText('Siripura Central College')).toHaveClass('sr-only');
    expect(screen.getByRole('link', { name: 'Subjects' })).toHaveAttribute('title', 'Subjects');
    await user.click(screen.getByRole('button', { name: 'Expand menu' }));
    expect(localStorage.getItem('sathiya.sidebar')).toBe('expanded');
  });

  it('keeps the school name for screen readers when collapsed without a logo', () => {
    localStorage.setItem('sathiya.sidebar', 'collapsed');
    renderSidebar();
    expect(screen.getByText('Siripura Central College')).toHaveClass('sr-only');
    expect(screen.queryByTestId('school-logo')).toBeNull();
  });

  it('starts collapsed from storage', () => {
    localStorage.setItem('sathiya.sidebar', 'collapsed');
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeInTheDocument();
  });

  describe('on a phone', () => {
    const phone = (matches: boolean) => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    };
    afterEach(() => vi.unstubAllGlobals());

    it('starts collapsed when nothing is stored', () => {
      phone(true);
      renderSidebar();
      expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'true');
    });

    it('lets a stored expanded choice win', () => {
      phone(true);
      localStorage.setItem('sathiya.sidebar', 'expanded');
      renderSidebar();
      expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'false');
    });

    it('starts expanded on larger screens', () => {
      phone(false);
      renderSidebar();
      expect(screen.getByRole('navigation')).toHaveAttribute('data-collapsed', 'false');
    });
  });

  it('shows My timetable only when the admin teaches', () => {
    renderSidebar();
    expect(screen.queryByRole('link', { name: 'My timetable' })).not.toBeInTheDocument();
    renderSidebar('/s/siripura/admin/teachers', { claims: { schools: { siripura: { r: 'a', t: 't1' } } } });
    expect(screen.getByRole('link', { name: 'My timetable' })).toHaveAttribute('href', '/s/siripura/me');
  });

  it('rewrites links under a super admin school view', () => {
    renderWithSchool(<Sidebar basePath="/super/schools/s1/admin" readOnly />, { ctx, route: '/super/schools/s1/admin/teachers', claims: { super: true } });
    expect(screen.getByRole('link', { name: 'Teachers' })).toHaveAttribute('href', '/super/schools/s1/admin/teachers');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/super/schools/s1/admin');
  });

  it('links to the super area only for super users', () => {
    renderSidebar();
    expect(screen.queryByRole('link', { name: 'Super admin' })).not.toBeInTheDocument();
    renderSidebar('/s/siripura/admin/teachers', { claims: { schools: { siripura: { r: 'a' } }, super: true } });
    expect(screen.getByRole('link', { name: 'Super admin' })).toHaveAttribute('href', '/super');
  });

  it('keeps the super link in the collapsed rail', () => {
    localStorage.setItem('sathiya.sidebar', 'collapsed');
    renderSidebar('/s/siripura/admin/teachers', { claims: { schools: { siripura: { r: 'a' } }, super: true } });
    expect(screen.getByRole('link', { name: 'Super admin' })).toHaveAttribute('title', 'Super admin');
  });

  it('shows the school switcher only with two or more schools', async () => {
    renderSidebar();
    expect(screen.queryByRole('combobox', { name: /^School/ })).not.toBeInTheDocument();
    renderSidebar('/s/siripura/admin/teachers', { claims: { schools: { siripura: { r: 'a' }, royal: { r: 't', t: 'T9' } } } });
    expect(await screen.findByRole('combobox', { name: /^School/ })).toHaveTextContent('Siripura Central College · Admin');
  });

  it('hides the switcher in the read-only super view', () => {
    renderWithSchool(<Sidebar basePath="/super/schools/siripura/admin" readOnly />, {
      ctx,
      route: '/super/schools/siripura/admin',
      claims: { schools: { a: { r: 'a' }, b: { r: 'a' } }, super: true },
    });
    expect(screen.queryByRole('combobox', { name: /^School/ })).not.toBeInTheDocument();
  });

  it('shows the pending join request count on Teachers', () => {
    join.count = 2;
    renderSidebar();
    expect(screen.getByRole('link', { name: /Teachers/ })).toHaveTextContent('2');
    expect(screen.getByText('2 join requests')).toBeInTheDocument();
    join.count = 0;
  });

  it('shows no badge without requests', () => {
    join.count = 0;
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Teachers' })).toHaveTextContent(/^Teachers$/);
  });

  it('does not listen for requests in the read-only view', () => {
    join.count = 3;
    renderWithSchool(<Sidebar readOnly />, { ctx, years: twoYears, route: '/super/schools/siripura/admin' });
    expect(join.sid).toBeNull();
    expect(screen.queryByText(/join requests/)).not.toBeInTheDocument();
    join.count = 0;
  });
});
