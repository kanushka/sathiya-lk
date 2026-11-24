// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Claims, Year } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../test/renderWithSchool';
import { PhoneTopBar } from './PhoneTopBar';
import { navItems } from './Sidebar';

vi.mock('../features/superadmin/SuperAdminLink', () => ({ SuperAdminLink: () => null }));

const years: Year[] = [
  { id: 'y27', label: '2027', status: 'draft' },
  { id: 'y26', label: '2026', status: 'published' },
];

let width = 375;
const listeners = new Set<() => void>();
const original = window.matchMedia;

function resize(w: number) {
  width = w;
  act(() => listeners.forEach((fn) => fn()));
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderBar(opts: { basePath?: string; readOnly?: boolean; claims?: Claims; name?: string; route?: string } = {}) {
  const school = opts.name ? { ...ctx.school, nameEn: opts.name } : ctx.school;
  return renderWithSchool(
    <>
      <PhoneTopBar basePath={opts.basePath} readOnly={opts.readOnly} />
      <Where />
    </>,
    { ctx: { ...ctx, school }, years, route: opts.route ?? '/admin', ...(opts.claims && { claims: opts.claims }) },
  );
}

const menu = () => screen.queryByRole('dialog', { name: 'Menu' });

describe('PhoneTopBar and PhoneMenu', () => {
  beforeEach(() => {
    width = 375;
    listeners.clear();
    document.body.style.overflow = '';
    window.matchMedia = vi.fn((query: string) => {
      const max = Number(/max-width:\s*([\d.]+)px/.exec(query)?.[1] ?? Infinity);
      return {
        get matches() {
          return width <= max;
        },
        media: query,
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      } as unknown as MediaQueryList;
    });
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('opens from the top bar and lists every nav item', async () => {
    const user = userEvent.setup();
    renderBar();
    const open = screen.getByRole('button', { name: 'Open menu' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await user.click(open);
    const dialog = menu()!;
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(navItems.map((i) => i.path));
    expect(within(dialog).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(within(dialog).getByLabelText('Timetable year')).toHaveTextContent('2027 · draft');
    expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('closes on the close button and returns focus to Open menu', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(menu()).toBeNull();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');
    expect(menu()).toBeNull();
  });

  it('closes after following a link', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(within(menu()!).getByRole('link', { name: 'Teachers' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/teachers');
    expect(menu()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('Escape with the year list open closes only the list', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(within(menu()!).getByLabelText('Timetable year'));
    expect(screen.getByRole('option', { name: '2026 · published' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option', { name: '2026 · published' })).toBeNull();
    expect(menu()).toBeInTheDocument();
  });

  it('unmounts when the viewport grows to desktop', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    resize(1024);
    expect(menu()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('read-only super view uses basePath and hides My timetable', async () => {
    const user = userEvent.setup();
    renderBar({ basePath: '/s/s1', readOnly: true, route: '/s/s1', claims: { sid: ctx.school.id, role: 'admin', tid: 't1' } });
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = menu()!;
    expect(within(dialog).getByRole('link', { name: 'Teachers' })).toHaveAttribute('href', '/s/s1/teachers');
    expect(within(dialog).getByText('Read-only view')).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'My timetable' })).toBeNull();
  });

  it('shows My timetable for an admin linked to a teacher', async () => {
    const user = userEvent.setup();
    renderBar({ claims: { sid: ctx.school.id, role: 'admin', tid: 't1' } });
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(within(menu()!).getByRole('link', { name: 'My timetable' })).toHaveAttribute('href', '/me');
  });

  it('truncates a long school name in the top bar', () => {
    const name = 'ශ්‍රී සිරිපුර මධ්‍ය මහා විද්‍යාලය සහ ජාතික පාසල සිරිපුර නගරය';
    renderBar({ name });
    expect(screen.getByText(name)).toHaveClass('truncate');
  });
});
