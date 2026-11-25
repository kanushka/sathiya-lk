// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import type { Member } from '@sathiya/core';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, call } from '../../lib/callable';
import { pickOption } from '../../test/pickOption';
import { renderWithSchool } from '../../test/renderWithSchool';
import { MembersPage } from './MembersPage';

const flags = vi.hoisted(() => ({ readOnly: false }));
const data = vi.hoisted(() => ({ members: [] as unknown[], invites: [] as unknown[] }));

vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));
vi.mock('../../lib/firestore', () => ({
  useCollection: (path: string | null) => ({ data: path?.endsWith('/members') ? data.members : data.invites, loading: false }),
}));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

const members: (Member & { id: string })[] = [
  { id: 'u1', uid: 'u1', role: 'admin', email: 'principal@siripura.lk', name: 'Principal Siripura' },
  { id: 'u2', uid: 'u2', role: 'admin', teacherId: 't-perera', email: 'perera@siripura.lk' },
  { id: 'u3', uid: 'u3', role: 'teacher', teacherId: 't-rizan' },
];

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
  data.members = members;
  data.invites = [{ id: 'i1', email: 'new@siripura.lk', teacherId: 't-kumari' }];
});

function setup() {
  renderWithSchool(<MembersPage />, { ctx });
  return userEvent.setup();
}

describe('members page', () => {
  it('lists admins, teachers with access and pending invites', () => {
    setup();
    const admin = screen.getByText('Principal Siripura').closest('tr')!;
    expect(within(admin).getByText('principal@siripura.lk')).toBeInTheDocument();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    expect(within(row).getByText('SCC024')).toBeInTheDocument();
    expect(within(row).getByText('Admin')).toBeInTheDocument();
    const teacher = screen.getByText('Mr. A. Rizan').closest('tr')!;
    expect(within(teacher).getByText('Teacher')).toBeInTheDocument();
    expect(within(teacher).getByText('—')).toBeInTheDocument();
    expect(screen.getByText('new@siripura.lk')).toBeInTheDocument();
  });

  it('invites an admin through the callable', async () => {
    vi.mocked(call).mockResolvedValue({ ok: true });
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Invite admin' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Send invite' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Email'), 'vp@siripura.lk');
    await pickOption(user, within(dialog).getByRole('combobox', { name: /^Link to a teacher/ }), /D\. Kumari/);
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    expect(call).toHaveBeenCalledWith('inviteAdmin', { schoolId: 'siripura', email: 'vp@siripura.lk', teacherId: 't-kumari' });
  });

  it('omits teacherId when none is linked and rejects bad emails', async () => {
    vi.mocked(call).mockResolvedValue({ ok: true });
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Invite admin' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email'), 'nope');
    expect(within(dialog).getByRole('button', { name: 'Send invite' })).toBeDisabled();
    await user.clear(within(dialog).getByLabelText('Email'));
    await user.type(within(dialog).getByLabelText('Email'), 'vp@siripura.lk');
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    expect(call).toHaveBeenCalledWith('inviteAdmin', { schoolId: 'siripura', email: 'vp@siripura.lk' });
  });

  it('shows an error and stays open when the invite fails', async () => {
    vi.mocked(call).mockRejectedValue(new Error('boom'));
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Invite admin' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email'), 'vp@siripura.lk');
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('Could not send the invite. Try again.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send invite' })).toBeEnabled();
  });

  it('shows the admin sign-in link and points teachers to the invite link', () => {
    setup();
    expect(screen.getByText(`${window.location.origin}/login`)).toBeInTheDocument();
    expect(screen.queryByText(/as=teacher/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teachers page' })).toHaveAttribute('href', '/s/siripura/admin/teachers');
  });

  it('copies the admin link and shows Copied!', async () => {
    const user = setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copy admin sign-in link' }));
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/login`);
    expect(await screen.findByRole('button', { name: 'Copy admin sign-in link' })).toHaveTextContent('Copied!');
  });

  it('toasts when copying fails', async () => {
    const user = setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copy admin sign-in link' }));
    expect(await screen.findByText('Could not copy. Select the link and copy it.')).toBeInTheDocument();
  });

  it('hides invite when read-only', () => {
    flags.readOnly = true;
    setup();
    expect(screen.queryByRole('button', { name: 'Invite admin' })).not.toBeInTheDocument();
    expect(screen.getByText('principal@siripura.lk')).toBeInTheDocument();
  });

  it('falls back to the email as the name when none is stored', () => {
    data.members = [{ id: 'u9', uid: 'u9', role: 'admin', email: 'vp@siripura.lk' }];
    setup();
    expect(screen.getAllByText('vp@siripura.lk')).toHaveLength(2);
  });
});

describe('members page while the school is pending review', () => {
  it('disables Invite admin with the approval note', () => {
    renderWithSchool(<MembersPage />, { ctx: { ...ctx, school: { ...ctx.school, status: 'pending' } } });
    const invite = screen.getByRole('button', { name: 'Invite admin' });
    expect(invite).toBeDisabled();
    expect(invite).toHaveAccessibleDescription('Available after Sathiya approves your school.');
  });

  it('shows the approval message when the server still refuses an invite', async () => {
    vi.mocked(call).mockRejectedValue(new ApiError('school-pending', 'raw'));
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Invite admin' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Email'), 'new@siripura.lk');
    await user.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    expect(await screen.findByText('Available after Sathiya approves your school.')).toBeInTheDocument();
  });
});
