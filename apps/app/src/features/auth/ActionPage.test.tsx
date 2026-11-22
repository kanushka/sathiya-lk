// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionPage } from './ActionPage';
import * as api from './api';
import { routes } from './routes';
import { renderAuth } from './testHarness';

vi.mock('./api');

const authError = (code: string) => Object.assign(new Error(code), { code });
const at = (qs: string) => renderAuth(<ActionPage />, { at: '/auth/action', route: `/auth/action?${qs}` });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('routing', () => {
  it('registers /auth/action as a public route', () => {
    expect(routes.map((r) => r.path)).toContain('/auth/action');
  });
});

describe('verifyEmail', () => {
  it('applies the code and offers to continue registering', async () => {
    vi.mocked(api.applyEmailCode).mockResolvedValue(undefined);
    at('mode=verifyEmail&oobCode=abc');
    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    expect(api.applyEmailCode).toHaveBeenCalledWith('abc');
    expect(screen.getByRole('link', { name: 'Continue registering' })).toHaveAttribute('href', '/register');
  });

  it('reads an encoded oobCode and ignores apiKey, lang and continueUrl', async () => {
    vi.mocked(api.applyEmailCode).mockResolvedValue(undefined);
    at(`mode=verifyEmail&oobCode=${encodeURIComponent('a+b/c=')}&apiKey=KEY&lang=si&continueUrl=${encodeURIComponent('https://app.example.test/login')}`);
    expect(await screen.findByRole('heading', { name: 'Email confirmed' })).toBeInTheDocument();
    expect(api.applyEmailCode).toHaveBeenCalledWith('a+b/c=');
  });

  it('explains an expired link', async () => {
    vi.mocked(api.applyEmailCode).mockRejectedValue(authError('auth/expired-action-code'));
    at('mode=verifyEmail&oobCode=abc');
    expect(await screen.findByRole('alert')).toHaveTextContent('This link has expired');
  });

  it('explains a used or invalid link', async () => {
    vi.mocked(api.applyEmailCode).mockRejectedValue(authError('auth/invalid-action-code'));
    at('mode=verifyEmail&oobCode=abc');
    expect(await screen.findByRole('alert')).toHaveTextContent('already been used or is not valid');
  });

  it('falls back to a generic error', async () => {
    vi.mocked(api.applyEmailCode).mockRejectedValue(new Error('boom'));
    at('mode=verifyEmail&oobCode=abc');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});

describe('resetPassword', () => {
  beforeEach(() => {
    vi.mocked(api.getResetEmail).mockResolvedValue('amara@siripura.lk');
    vi.mocked(api.confirmNewPassword).mockResolvedValue(undefined);
  });

  async function fill(user: ReturnType<typeof userEvent.setup>, pw: string, confirm: string) {
    await screen.findByText('amara@siripura.lk');
    await user.type(screen.getByLabelText('New password'), pw);
    await user.type(screen.getByLabelText('Confirm new password'), confirm);
    await user.click(screen.getByRole('button', { name: 'Set new password' }));
  }

  it('shows the account email and resets the password', async () => {
    const user = userEvent.setup();
    at('mode=resetPassword&oobCode=xyz');
    await fill(user, 'secret12', 'secret12');
    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
    expect(api.confirmNewPassword).toHaveBeenCalledWith('xyz', 'secret12');
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login');
  });

  it('rejects a short password', async () => {
    const user = userEvent.setup();
    at('mode=resetPassword&oobCode=xyz');
    await fill(user, 'abcdefg', 'abcdefg');
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
    expect(api.confirmNewPassword).not.toHaveBeenCalled();
  });

  it('rejects a mismatched confirmation', async () => {
    const user = userEvent.setup();
    at('mode=resetPassword&oobCode=xyz');
    await fill(user, 'secret12', 'secret22');
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(api.confirmNewPassword).not.toHaveBeenCalled();
  });

  it('shows an error when the code is expired', async () => {
    vi.mocked(api.getResetEmail).mockRejectedValue(authError('auth/expired-action-code'));
    at('mode=resetPassword&oobCode=xyz');
    expect(await screen.findByRole('alert')).toHaveTextContent('This link has expired');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('shows an error when the code was already used at submit time', async () => {
    const user = userEvent.setup();
    vi.mocked(api.confirmNewPassword).mockRejectedValue(authError('auth/invalid-action-code'));
    at('mode=resetPassword&oobCode=xyz');
    await fill(user, 'secret12', 'secret12');
    expect(await screen.findByRole('alert')).toHaveTextContent('already been used or is not valid');
  });

  it('surfaces a weak-password rejection from Firebase', async () => {
    const user = userEvent.setup();
    vi.mocked(api.confirmNewPassword).mockRejectedValue(authError('auth/weak-password'));
    at('mode=resetPassword&oobCode=xyz');
    await fill(user, 'secret12', 'secret12');
    await waitFor(() => expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument());
  });

  it('surfaces a password-policy rejection from Firebase', async () => {
    const user = userEvent.setup();
    vi.mocked(api.confirmNewPassword).mockRejectedValue(authError('auth/password-does-not-meet-requirements'));
    at('mode=resetPassword&oobCode=xyz');
    await fill(user, 'secret12', 'secret12');
    await waitFor(() => expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument());
  });
});

describe('recoverEmail', () => {
  it('shows the restored email then applies the code', async () => {
    vi.mocked(api.getRecoveredEmail).mockResolvedValue('old@siripura.lk');
    vi.mocked(api.applyEmailCode).mockResolvedValue(undefined);
    at('mode=recoverEmail&oobCode=rec');
    expect(await screen.findByRole('heading', { name: 'Email restored' })).toBeInTheDocument();
    expect(screen.getByText(/old@siripura\.lk/)).toBeInTheDocument();
    expect(api.applyEmailCode).toHaveBeenCalledWith('rec');
  });

  it('shows an error when the code is invalid', async () => {
    vi.mocked(api.getRecoveredEmail).mockRejectedValue(authError('auth/invalid-action-code'));
    at('mode=recoverEmail&oobCode=rec');
    expect(await screen.findByRole('alert')).toHaveTextContent('already been used or is not valid');
    expect(api.applyEmailCode).not.toHaveBeenCalled();
  });
});

describe('error states', () => {
  it.each([
    ['verifyEmail', () => vi.mocked(api.applyEmailCode).mockRejectedValue(authError('auth/invalid-action-code'))],
    ['resetPassword', () => vi.mocked(api.getResetEmail).mockRejectedValue(authError('auth/expired-action-code'))],
    ['recoverEmail', () => vi.mocked(api.getRecoveredEmail).mockRejectedValue(authError('auth/invalid-action-code'))],
  ])('%s offers a way back to login', async (mode, fail) => {
    fail();
    at(`mode=${mode}&oobCode=bad`);
    await screen.findByRole('alert');
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login');
  });
});

describe('bad requests', () => {
  it.each(['', 'mode=bogus&oobCode=a', 'mode=verifyEmail', 'oobCode=a'])('shows an invalid-link error for "%s"', async (qs) => {
    at(qs);
    expect(await screen.findByRole('alert')).toHaveTextContent('This link is not valid');
    expect(api.applyEmailCode).not.toHaveBeenCalled();
  });
});
