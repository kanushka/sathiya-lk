import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';

const auth = vi.hoisted(() => ({ value: { claims: { sid: 's1', role: 'admin' } as Record<string, unknown> } }));

vi.mock('../lib/firebase', () => ({ app: {}, auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock('../app/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false, claims: auth.value.claims, refreshClaims: vi.fn(), signOut: vi.fn() }),
}));
vi.mock('../app/SchoolProvider', () => ({
  useSchool: () => ({
    loading: false,
    school: { id: 's1', nameEn: 'Siripura Central College', colors: { primary: '#7A1F3D', second: '#D9A441' } },
    teachers: [], subjects: [], templates: [], grades: [], classes: [],
  }),
  useYear: () => ({
    years: [
      { id: 'y27', label: '2027', status: 'draft' },
      { id: 'y26', label: '2026', status: 'published' },
    ],
    yearId: 'y27',
    setYearId: vi.fn(),
    entries: [],
  }),
}));

const { Sidebar, navItems } = await import('./Sidebar');

function renderSidebar(path = '/admin/teachers') {
  return renderWithI18n(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    auth.value.claims = { sid: 's1', role: 'admin' };
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
    auth.value.claims = { sid: 's1', role: 'admin', tid: 't1' };
    renderSidebar();
    expect(screen.getByRole('link', { name: 'My timetable' })).toHaveAttribute('href', '/me');
  });

  it('rewrites links under a super admin school view', () => {
    renderWithI18n(
      <MemoryRouter initialEntries={['/s/s1/teachers']}>
        <Sidebar basePath="/s/s1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Teachers' })).toHaveAttribute('href', '/s/s1/teachers');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/s/s1');
  });
});
