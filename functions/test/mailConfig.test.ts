// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mailConfig } from '../src/email/params';

afterEach(() => vi.unstubAllEnvs());

describe('mailConfig', () => {
  it('defaults to the production hosts', () => {
    expect(mailConfig()).toMatchObject({ appUrl: 'https://app.sathiya.kanushka.com', webUrl: 'https://sathiya.kanushka.com' });
  });

  it('uses the local hosts when the emulator run sets them, without a trailing slash', () => {
    vi.stubEnv('APP_URL', 'http://localhost:5173/');
    vi.stubEnv('WEB_URL', 'http://localhost:4321');
    expect(mailConfig()).toMatchObject({ appUrl: 'http://localhost:5173', webUrl: 'http://localhost:4321' });
  });
});
