// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { LoginPage } from './LoginPage';
import { renderAuth } from './testHarness';

vi.mock('./api');

const siripura = { id: 'siripura', nameEn: 'Siripura Central College', district: 'Kandy', city: 'Peradeniya', status: 'active' as const };

function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.searchSchools).mockResolvedValue([siripura]);
  vi.mocked(api.getDirectorySchool).mockResolvedValue(null);
  vi.mocked(api.signInWithPassword).mockResolvedValue(undefined);
  vi.mocked(api.signInWithGoogle).mockResolvedValue(undefined);
  vi.mocked(api.claimInvites).mockResolvedValue(undefined);
});

const teacherCard = () => screen.getByRole('heading', { name: 'Teacher login' }).closest('form') as HTMLElement;

async function pickSchool(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('School'), 'siri');
  await user.click(await screen.findByRole('option', { name: /Siripura Central College/ }));
}

describe('school search labels', () => {
  it('shows "Name, City" on each result', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    await user.type(screen.getByLabelText('School'), 'siri');
    expect((await screen.findByRole('option')).textContent).toBe('Siripura Central College, Peradeniya');
  });

  it('omits the city when the directory doc has none', async () => {
    const user = userEvent.setup();
    const { city: _city, ...noCity } = siripura;
    vi.mocked(api.searchSchools).mockResolvedValue([noCity]);
    renderAuth(<LoginPage />);
    await user.type(screen.getByLabelText('School'), 'siri');
    expect(await screen.findByRole('option', { name: 'Siripura Central College' })).toBeInTheDocument();
  });
});

describe('report a school', () => {
  it('opens the report popup from the login page', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Report a school' }));
    expect(screen.getByRole('dialog', { name: 'Report a school' })).toBeInTheDocument();
  });

  it('hints at an 8-character teacher password', () => {
    renderAuth(<LoginPage />);
    expect(screen.getByText('The 8-character password on your login slip.')).toBeInTheDocument();
  });
});

describe('teacher login', () => {
  it('signs in with a synthetic email built from school and uppercased staff ID', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, claimsAfterRefresh: { sid: 'siripura', role: 'teacher', tid: 't1' } });
    await pickSchool(user);
    await user.type(screen.getByLabelText('Staff ID'), 'scc024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'k7m4x9pq');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(api.signInWithPassword).toHaveBeenCalledWith('scc024@siripura.teachers.sathiya.lk', 'k7m4x9pq'),
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('/me');
  });

  it('shows the wrong-credentials message', async () => {
    const user = userEvent.setup();
    vi.mocked(api.signInWithPassword).mockRejectedValue(authError('auth/invalid-credential'));
    renderAuth(<LoginPage />);
    await pickSchool(user);
    await user.type(screen.getByLabelText('Staff ID'), 'SCC024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'bad');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    expect(await within(teacherCard()).findByRole('alert')).toHaveTextContent('Wrong staff ID or password');
  });

  it('remembers the chosen school and restores it', async () => {
    const user = userEvent.setup();
    const first = renderAuth(<LoginPage />);
    await pickSchool(user);
    expect(JSON.parse(localStorage.getItem('sathiya.school') ?? '{}')).toMatchObject({ id: 'siripura' });
    first.unmount();
    renderAuth(<LoginPage />);
    expect(screen.getByLabelText('School')).toHaveValue('Siripura Central College, Peradeniya');
  });

  it('preselects the school from ?school=', async () => {
    vi.mocked(api.getDirectorySchool).mockResolvedValue(siripura);
    renderAuth(<LoginPage />, { route: '/login?school=siripura' });
    await waitFor(() => expect(screen.getByLabelText('School')).toHaveValue('Siripura Central College, Peradeniya'));
    expect(api.getDirectorySchool).toHaveBeenCalledWith('siripura');
  });

  it('requires a school before submitting', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    await user.type(screen.getByLabelText('Staff ID'), 'SCC024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'k7m4x9pq');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    expect(api.signInWithPassword).not.toHaveBeenCalled();
    expect(await screen.findByText('Choose your school first')).toBeInTheDocument();
  });

  it('focuses the teacher card for ?as=teacher', async () => {
    renderAuth(<LoginPage />, { route: '/login?as=teacher' });
    await waitFor(() => expect(screen.getByLabelText('School')).toHaveFocus());
  });
});

describe('admin login', () => {
  const adminCard = () => screen.getByRole('heading', { name: 'Admin login' }).closest('form') as HTMLElement;

  it('claims invites, refreshes claims and routes admins to /admin', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    vi.mocked(api.claimInvites).mockImplementation(async () => void order.push('claim'));
    renderAuth(<LoginPage />, {
      signedIn: true,
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
      refreshClaims: async () => void order.push('refresh'),
    });
    const card = within(adminCard());
    await user.type(card.getByLabelText('Email'), 'principal@siripura.lk');
    await user.type(card.getByLabelText('Password'), 'secret12');
    await user.click(card.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(api.signInWithPassword).toHaveBeenCalledWith('principal@siripura.lk', 'secret12'),
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin');
    expect(order).toEqual(['claim', 'refresh']);
  });

  it.each([
    [{ super: true }, '/super'],
    [{}, '/register'],
  ])('routes claims %j to %s', async (claims, path) => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, claimsAfterRefresh: claims });
    await user.click(within(adminCard()).getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByTestId('where')).toHaveTextContent(path);
    expect(api.claimInvites).toHaveBeenCalled();
  });

  it('still routes when claimInvites fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.claimInvites).mockRejectedValue(new Error('boom'));
    renderAuth(<LoginPage />, { signedIn: true, claimsAfterRefresh: { sid: 's', role: 'admin' } });
    await user.click(within(adminCard()).getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin');
  });

  it('shows wrong-credentials message and stays put', async () => {
    const user = userEvent.setup();
    vi.mocked(api.signInWithPassword).mockRejectedValue(authError('auth/wrong-password'));
    renderAuth(<LoginPage />);
    const card = within(adminCard());
    await user.type(card.getByLabelText('Email'), 'a@b.lk');
    await user.type(card.getByLabelText('Password'), 'nope');
    await user.click(card.getByRole('button', { name: 'Log in' }));
    expect(await card.findByRole('alert')).toHaveTextContent('Wrong email or password');
    expect(api.claimInvites).not.toHaveBeenCalled();
  });

  it('ignores a closed Google popup', async () => {
    const user = userEvent.setup();
    vi.mocked(api.signInWithGoogle).mockRejectedValue(authError('auth/popup-closed-by-user'));
    renderAuth(<LoginPage />);
    await user.click(within(adminCard()).getByRole('button', { name: 'Continue with Google' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.claimInvites).not.toHaveBeenCalled();
  });
});

describe('refreshClaims failure after sign-in', () => {
  const failing = async () => {
    throw new Error('token');
  };

  it('teacher still navigates home without an error', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, claims: { sid: 's', role: 'teacher', tid: 't' }, refreshClaims: failing });
    await pickSchool(user);
    await user.type(screen.getByLabelText('Staff ID'), 'SCC024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'k7m4x9pq');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/me');
  });

  it('admin still navigates home without an error', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, claims: { sid: 's', role: 'admin' }, refreshClaims: failing });
    const card = within(screen.getByRole('heading', { name: 'Admin login' }).closest('form') as HTMLElement);
    await user.click(card.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin');
  });
});
