// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { call } from '../../lib/callable';
import { recordSignIn, recordSignInOnce } from './signIn';

vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});

describe('recordSignIn', () => {
  it('calls the callable and ignores a failure', async () => {
    vi.mocked(call).mockRejectedValue(new Error('offline'));
    expect(() => recordSignIn()).not.toThrow();
    await Promise.resolve();
    expect(call).toHaveBeenCalledWith('recordSignIn', {});
  });

  it('records at most once per session from /me', async () => {
    vi.mocked(call).mockResolvedValue({ recorded: true });
    recordSignInOnce();
    await Promise.resolve();
    await Promise.resolve();
    recordSignInOnce();
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('skips /me when the login already recorded it', async () => {
    vi.mocked(call).mockResolvedValue({ recorded: true });
    recordSignIn();
    await Promise.resolve();
    await Promise.resolve();
    recordSignInOnce();
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries from /me when the login call failed', async () => {
    vi.mocked(call).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ recorded: true });
    recordSignIn();
    await Promise.resolve();
    await Promise.resolve();
    recordSignInOnce();
    expect(call).toHaveBeenCalledTimes(2);
  });
});
