// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { DEFAULT_WEB_URL, webUrl } from './urls';

describe('webUrl', () => {
  it('defaults to the production site', () => {
    expect(webUrl('/terms/', undefined)).toBe(`${DEFAULT_WEB_URL}/terms/`);
    expect(webUrl('/terms/', '')).toBe('https://sathiya.kanushka.com/terms/');
  });

  it('uses the configured base and drops a trailing slash', () => {
    expect(webUrl('/privacy/', 'https://staging.example.com/')).toBe('https://staging.example.com/privacy/');
  });
});
