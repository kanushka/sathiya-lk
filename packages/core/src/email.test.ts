// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { EMAIL_RE } from './email';

describe('EMAIL_RE', () => {
  it('accepts a plain address and rejects malformed ones', () => {
    expect(EMAIL_RE.test('parent@example.lk')).toBe(true);
    for (const bad of ['bad-email', 'a@b', 'a b@c.lk', 'a@b/c.lk', '@b.lk']) expect(EMAIL_RE.test(bad)).toBe(false);
  });
});
