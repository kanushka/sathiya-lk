// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { appCheckEnforced } from '../src/lib/callOptions';

describe('appCheckEnforced', () => {
  it('is on by default and off in the emulator or when switched off', () => {
    expect(appCheckEnforced({})).toBe(true);
    expect(appCheckEnforced({ ENFORCE_APP_CHECK: 'true' })).toBe(true);
    expect(appCheckEnforced({ FUNCTIONS_EMULATOR: 'true' })).toBe(false);
    expect(appCheckEnforced({ ENFORCE_APP_CHECK: 'false' })).toBe(false);
  });
});
