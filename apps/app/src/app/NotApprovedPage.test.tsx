// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../test/renderWithSchool';
import { NotApprovedPage } from './NotApprovedPage';

const sid = ctx.school.id;
const school = {
  ...ctx.school,
  status: 'rejected' as const,
  review: { moeMatched: false, reason: "We couldn't confirm that you work at this school.", decidedAt: Date.UTC(2026, 10, 25), decidedBy: 'super' },
};

function setup({ remove = vi.fn().mockResolvedValue({ ok: true }), refreshClaims = vi.fn().mockResolvedValue({}), admin = true } = {}) {
  const order: string[] = [];
  remove.mockImplementation(async () => {
    order.push('remove');
    return { ok: true };
  });
  refreshClaims.mockImplementation(async () => {
    order.push('refresh');
    return {};
  });
  renderWithSchool(
    <Routes>
      <Route path="/s/:sid/admin" element={<NotApprovedPage sid={sid} school={school} remove={remove} />} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes>,
    {
      ctx,
      route: `/s/${sid}/admin`,
      refreshClaims,
      claims: { schools: { [sid]: { r: admin ? 'a' : 't', ...(admin ? {} : { t: 't1' }) } } },
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

  it('removes the registration after confirm, refreshes claims, then goes home', async () => {
    const { remove, refreshClaims, order, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove registration…' }));
    expect(remove).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Remove Siripura Central College?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove registration' }));
    expect(await screen.findByText('Home page')).toBeInTheDocument();
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
    expect(screen.queryByText('Home page')).not.toBeInTheDocument();
  });

  it('offers removal to admins only', () => {
    setup({ admin: false });
    expect(screen.queryByRole('button', { name: 'Remove registration…' })).not.toBeInTheDocument();
  });
});
