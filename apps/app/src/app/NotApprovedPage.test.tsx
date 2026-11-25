// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../test/renderWithSchool';
import { useAuth } from './AuthProvider';
import { NotApprovedPage } from './NotApprovedPage';
import { homePath, LAST_SCHOOL_KEY, readLastSchool, rememberLastSchool, unmarkSchoolRemoved } from './schoolHome';

vi.mock('./memberSchools', () => ({ fetchSchoolNames: vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id === 'royal' ? 'Royal College' : 'Siripura']))) }));

function HomeProbe() {
  const { claims } = useAuth();
  return <p>Home page: {homePath(claims, readLastSchool())}</p>;
}

const sid = ctx.school.id;
const school = {
  ...ctx.school,
  status: 'rejected' as const,
  review: { moeMatched: false, reason: "We couldn't confirm that you work at this school.", decidedAt: Date.UTC(2026, 10, 25), decidedBy: 'super' },
};

afterEach(() => {
  unmarkSchoolRemoved(sid);
  localStorage.clear();
});

function setup({
  remove = vi.fn().mockResolvedValue({ ok: true }),
  refreshClaims = vi.fn().mockResolvedValue({}),
  admin = true,
  refreshNever = false,
  others = {} as Record<string, { r: 'a' }>,
} = {}) {
  const order: string[] = [];
  remove.mockImplementation(async () => {
    order.push('remove');
    return { ok: true };
  });
  refreshClaims.mockImplementation(() => {
    order.push('refresh');
    return refreshNever ? new Promise(() => undefined) : Promise.resolve({});
  });
  renderWithSchool(
    <Routes>
      <Route path="/s/:sid/admin" element={<NotApprovedPage sid={sid} school={school} remove={remove} />} />
      <Route path="/" element={<HomeProbe />} />
      <Route path="/s/royal/admin" element={<p>Royal admin</p>} />
    </Routes>,
    {
      ctx,
      route: `/s/${sid}/admin`,
      refreshClaims,
      claims: { schools: { [sid]: admin ? { r: 'a' } : { r: 't', t: 't1' }, ...others } },
    },
  );
  return { remove, refreshClaims, order, user: userEvent.setup() };
}

describe('NotApprovedPage', () => {
  it('shows the reason, the decision date and the contact email', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Siripura Central College was not approved' })).toBeInTheDocument();
    expect(screen.getByText(/reviewed your registration on 25 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText("We couldn't confirm that you work at this school.")).toBeInTheDocument();
    const mail = screen.getByRole('link', { name: 'Email sathiya@kanushka.com' });
    expect(mail.getAttribute('href')).toMatch(/^mailto:sathiya@kanushka\.com\?subject=/);
  });

  it('removes the registration after confirm, starts a claims refresh and goes home without waiting for it', async () => {
    const { remove, refreshClaims, order, user } = setup({ refreshNever: true });
    await user.click(screen.getByRole('button', { name: 'Remove registration…' }));
    expect(remove).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Remove Siripura Central College?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove registration' }));
    expect(await screen.findByText('Home page: /start')).toBeInTheDocument();
    expect(remove).toHaveBeenCalledWith({ schoolId: sid });
    expect(refreshClaims).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['remove', 'refresh']);
    expect(screen.getByText('Registration removed')).toBeInTheDocument();
  });

  it('cancel keeps the registration', async () => {
    const { remove, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove registration…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
  });

  it('stays on the page with an error when removal fails', async () => {
    const remove = vi.fn();
    const { refreshClaims, user } = setup({ remove });
    remove.mockRejectedValue(new Error('boom'));
    await user.click(screen.getByRole('button', { name: 'Remove registration…' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove registration' }));
    expect(await screen.findByText('Could not remove the registration. Try again.')).toBeInTheDocument();
    expect(refreshClaims).not.toHaveBeenCalled();
    expect(screen.queryByText(/Home page/)).not.toBeInTheDocument();
    expect(homePath({ schools: { [sid]: { r: 'a' } } }, null)).toBe(`/s/${sid}/admin`);
  });

  it('shows a teacher a short message without admin actions', () => {
    setup({ admin: false });
    expect(screen.getByText("This school isn't active on Sathiya yet. Ask your school admin.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove registration…' })).not.toBeInTheDocument();
    expect(screen.queryByText("We couldn't confirm that you work at this school.")).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Email/ })).not.toBeInTheDocument();
  });

  it('forgets this school as the last one used', () => {
    rememberLastSchool(sid);
    setup();
    expect(localStorage.getItem(LAST_SCHOOL_KEY)).toBeNull();
  });

  it('lets a member of several schools switch to another school', async () => {
    const { user } = setup({ others: { royal: { r: 'a' } } });
    await user.click(await screen.findByRole('combobox', { name: /^School/ }));
    await user.click(await screen.findByRole('option', { name: 'Royal College · Admin' }));
    expect(await screen.findByText('Royal admin')).toBeInTheDocument();
  });
});
