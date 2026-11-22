// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import type { Member } from '@sathiya/core';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { call } from '../../lib/callable';
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
  { id: 'u1', uid: 'u1', role: 'admin', email: 'principal@siripura.lk' },
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
    expect(screen.getByText('principal@siripura.lk')).toBeInTheDocument();
    const row = screen.getByText('Mrs. N. Perera').closest('tr')!;
    expect(within(row).getByText('SCC024')).toBeInTheDocument();
    expect(within(row).getByText('Admin')).toBeInTheDocument();
    expect(within(screen.getByText('Mr. A. Rizan').closest('tr')!).getByText('Teacher')).toBeInTheDocument();
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

  it('copies the app link', async () => {
    const user = setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(window.location.origin);
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('hides invite when read-only', () => {
    flags.readOnly = true;
    setup();
    expect(screen.queryByRole('button', { name: 'Invite admin' })).not.toBeInTheDocument();
    expect(screen.getByText('principal@siripura.lk')).toBeInTheDocument();
  });
});
