import type { Claims, Year } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithSchool } from '../test/renderWithSchool';
import { Sidebar, navItems } from './Sidebar';

const twoYears: Year[] = [
  { id: 'y27', label: '2027', status: 'draft' },
  { id: 'y26', label: '2026', status: 'published' },
];

function renderSidebar(path = '/admin/teachers', opts: { years?: Year[]; claims?: Claims } = {}) {
  return renderWithSchool(<Sidebar />, { ctx, years: opts.years ?? twoYears, route: path, ...(opts.claims && { claims: opts.claims }) });
}

describe('Sidebar', () => {
  it('shows the year heading as plain text when there are no years', () => {
    renderSidebar('/admin/teachers', { years: [] });
    expect(screen.getByText('No years yet')).toBeInTheDocument();
    expect(screen.getByText('Timetable year').tagName).toBe('P');
    expect(document.querySelector('label[for]')).toBeNull();
  });

  it('lists the admin nav paths', () => {
    expect(navItems.map((i) => i.path)).toEqual([
      '/admin',
      '/admin/timetable/class',
      '/admin/timetable/teacher',
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
    await user.selectOptions(screen.getByLabelText('Timetable year'), 'y26');
    expect(screen.getByLabelText('Timetable year')).toHaveValue('y26');
  });

  it('shows school name, year select and active link', () => {
    renderSidebar();
    expect(screen.getByText('Siripura Central College')).toBeInTheDocument();
    expect(screen.getByLabelText('Timetable year')).toHaveValue('y27');
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
    expect(screen.queryByText('Siripura Central College')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Subjects' })).toHaveAttribute('title', 'Subjects');
    await user.click(screen.getByRole('button', { name: 'Expand menu' }));
    expect(localStorage.getItem('sathiya.sidebar')).toBe('expanded');
  });

  it('starts collapsed from storage', () => {
    localStorage.setItem('sathiya.sidebar', 'collapsed');
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeInTheDocument();
  });

  it('shows My timetable only when the admin teaches', () => {
    renderSidebar();
    expect(screen.queryByRole('link', { name: 'My timetable' })).not.toBeInTheDocument();
    renderSidebar('/admin/teachers', { claims: { sid: 's1', role: 'admin', tid: 't1' } });
    expect(screen.getByRole('link', { name: 'My timetable' })).toHaveAttribute('href', '/me');
  });

  it('rewrites links under a super admin school view', () => {
    renderWithSchool(<Sidebar basePath="/s/s1" />, { ctx, route: '/s/s1/teachers', claims: { super: true } });
    expect(screen.getByRole('link', { name: 'Teachers' })).toHaveAttribute('href', '/s/s1/teachers');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/s/s1');
  });
});
