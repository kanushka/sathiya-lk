// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { ApiErrorCode } from '@sathiya/core';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import * as authApi from '../auth/api';
import { renderAuth } from '../auth/testHarness';
import * as registerApi from '../register/api';
import * as api from './api';
import { JoinPage } from './JoinPage';

vi.mock('./api');
vi.mock('../auth/api');
vi.mock('../register/api');
vi.mock('../auth/authEmail');

const apiError = (code: ApiErrorCode) => new ApiError(code, code, { code });

const SCHOOL = { route: '/join/s1/tok1', at: '/join/:sid/:token' };
const PERSONAL = { route: '/join/t/tok2', at: '/join/t/:token' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(authApi.getDirectorySchool).mockResolvedValue({ id: 's1', nameEn: 'Siripura Central College', district: 'Kandy', status: 'active' });
});

describe('JoinPage', () => {
  it('sends a signed-out visitor to sign in and back here', async () => {
    renderAuth(<JoinPage />, SCHOOL);
    expect(await screen.findByTestId('where')).toHaveTextContent('/login');
    expect(api.joinSchool).not.toHaveBeenCalled();
  });

  it('asks an unverified email account to verify first', async () => {
    vi.mocked(registerApi.confirmVerified).mockResolvedValue(true);
    vi.mocked(api.joinSchool).mockResolvedValue({ status: 'pending', schoolId: 's1', teacherId: 't1' });
    const user = userEvent.setup();
    renderAuth(<JoinPage />, { ...SCHOOL, signedIn: true, passwordUser: true, emailVerified: false });
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(api.joinSchool).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: "I've confirmed it" }));
    expect(await screen.findByText('Waiting for your school admin')).toBeInTheDocument();
    expect(api.joinSchool).toHaveBeenCalledWith({ sid: 's1', token: 'tok1' });
  });

  it('links at once, refreshes claims, then opens the timetable', async () => {
    const order: string[] = [];
    vi.mocked(api.joinSchool).mockImplementation(async () => {
      order.push('join');
      return { status: 'linked', schoolId: 's9', teacherId: 't1' };
    });
    renderAuth(<JoinPage />, {
      ...PERSONAL,
      signedIn: true,
      emailVerified: true,
      refreshClaims: async () => {
        order.push('refresh');
      },
    });
    expect(await screen.findByTestId('where')).toHaveTextContent('/s/s9/me');
    expect(order).toEqual(['refresh', 'join', 'refresh']);
    expect(api.joinSchool).toHaveBeenCalledTimes(1);
    expect(api.joinSchool).toHaveBeenCalledWith({ token: 'tok2' });
  });

  it('shows the school name and the waiting screen for a pending request', async () => {
    vi.mocked(api.joinSchool).mockResolvedValue({ status: 'pending', schoolId: 's1', teacherId: 't1' });
    renderAuth(<JoinPage />, { ...SCHOOL, signedIn: true, emailVerified: true });
    expect(await screen.findByText('Waiting for your school admin')).toBeInTheDocument();
    expect(await screen.findByText('Siripura Central College')).toBeInTheDocument();
  });

  it('asks for the staff ID when the email does not match, then files a request', async () => {
    vi.mocked(api.joinSchool)
      .mockRejectedValueOnce(apiError('invalid'))
      .mockResolvedValueOnce({ status: 'pending', schoolId: 's1', teacherId: 't1' });
    const user = userEvent.setup();
    renderAuth(<JoinPage />, { ...SCHOOL, signedIn: true, emailVerified: true });
    const input = await screen.findByLabelText('Staff ID');
    await user.type(input, 'scc024');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Waiting for your school admin')).toBeInTheDocument();
    expect(api.joinSchool).toHaveBeenLastCalledWith({ sid: 's1', token: 'tok1' }, 'SCC024');
  });

  it('shows an unknown staff ID next to the field', async () => {
    vi.mocked(api.joinSchool)
      .mockRejectedValueOnce(apiError('invalid'))
      .mockRejectedValueOnce(apiError('staff-id-unknown'));
    const user = userEvent.setup();
    renderAuth(<JoinPage />, { ...SCHOOL, signedIn: true, emailVerified: true });
    await user.type(await screen.findByLabelText('Staff ID'), 'SCC999');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('No teacher has this staff ID. Check it and try again.')).toBeInTheDocument();
    expect(screen.getByLabelText('Staff ID')).toBeInTheDocument();
  });

  it('says a staff ID is already linked and to ask the admin', async () => {
    vi.mocked(api.joinSchool)
      .mockRejectedValueOnce(apiError('invalid'))
      .mockRejectedValueOnce(apiError('already-linked'));
    const user = userEvent.setup();
    renderAuth(<JoinPage />, { ...SCHOOL, signedIn: true, emailVerified: true });
    await user.type(await screen.findByLabelText('Staff ID'), 'SCC024');
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText(/already linked to an account\. Ask your school admin to unlink it/)).toBeInTheDocument();
  });

  it('explains an already-linked personal link', async () => {
    vi.mocked(api.joinSchool).mockRejectedValue(apiError('already-linked'));
    renderAuth(<JoinPage />, { ...PERSONAL, signedIn: true, emailVerified: true });
    expect(await screen.findByRole('heading', { name: 'Already linked' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Staff ID')).not.toBeInTheDocument();
  });

  it('says when a link no longer works', async () => {
    vi.mocked(api.joinSchool).mockRejectedValue(apiError('link-invalid'));
    renderAuth(<JoinPage />, { ...SCHOOL, signedIn: true, emailVerified: true });
    expect(await screen.findByRole('heading', { name: 'This link does not work' })).toBeInTheDocument();
  });

  it('says when the account is in too many schools', async () => {
    vi.mocked(api.joinSchool).mockRejectedValue(apiError('too-many-schools'));
    renderAuth(<JoinPage />, { ...PERSONAL, signedIn: true, emailVerified: true });
    expect(await screen.findByText('This account already belongs to the most schools allowed (15).')).toBeInTheDocument();
  });

  it('offers a retry after an unexpected error', async () => {
    vi.mocked(api.joinSchool)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status: 'pending', schoolId: 's9' });
    const user = userEvent.setup();
    renderAuth(<JoinPage />, { ...PERSONAL, signedIn: true, emailVerified: true });
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Waiting for your school admin')).toBeInTheDocument();
  });

  it('does not join again when already a teacher in this school', async () => {
    renderAuth(<JoinPage />, { ...SCHOOL, signedIn: true, emailVerified: true, claims: { schools: { s1: { r: 't', t: 't1' } } } });
    expect(await screen.findByRole('link', { name: 'Open my timetable' })).toHaveAttribute('href', '/s/s1/me');
    await waitFor(() => expect(api.joinSchool).not.toHaveBeenCalled());
  });

  it('refreshes claims first, so an approved teacher reopening the link goes to the timetable', async () => {
    renderAuth(<JoinPage />, {
      ...SCHOOL,
      signedIn: true,
      emailVerified: true,
      claimsAfterRefresh: { schools: { s1: { r: 't', t: 't1' } } },
    });
    expect(await screen.findByRole('link', { name: 'Open my timetable' })).toBeInTheDocument();
    expect(api.joinSchool).not.toHaveBeenCalled();
  });
});
