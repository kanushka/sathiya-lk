// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import * as api from './api';
import { AdminLoginForm } from './AdminLoginForm';
import * as authEmail from './authEmail';
import { renderAuth } from './testHarness';

vi.mock('./api');
vi.mock('./authEmail');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(authEmail.sendAuthEmail).mockResolvedValue(undefined);
});

async function requestReset(email = 'amara@siripura.lk') {
  const user = userEvent.setup();
  renderAuth(<AdminLoginForm />);
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
}

describe('AdminLoginForm password reset', () => {
  it('requests a reset through sendAuthEmail and shows the neutral message', async () => {
    await requestReset();
    expect(authEmail.sendAuthEmail).toHaveBeenCalledWith({ kind: 'reset', email: 'amara@siripura.lk', lang: 'en' });
    expect(await screen.findByText("If an account exists, we've sent a link.")).toBeInTheDocument();
    expect(api.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows the same neutral message on a non-rate-limit error', async () => {
    vi.mocked(authEmail.sendAuthEmail).mockRejectedValue(new ApiError('invalid', 'not-found'));
    await requestReset();
    expect(await screen.findByText("If an account exists, we've sent a link.")).toBeInTheDocument();
  });

  it('shows the rate-limit message', async () => {
    vi.mocked(authEmail.sendAuthEmail).mockRejectedValue(new ApiError('invalid', 'x', { code: 'rate-limited' }));
    await requestReset();
    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
    expect(screen.queryByText("If an account exists, we've sent a link.")).not.toBeInTheDocument();
  });
});
