// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { appCheckMode } from './appCheck';

describe('appCheckMode', () => {
  it('is off without a site key outside emulators', () => {
    expect(appCheckMode({})).toBe('off');
    expect(appCheckMode({ VITE_APPCHECK_SITE_KEY: '' })).toBe('off');
  });

  it('uses reCAPTCHA with a site key', () => {
    expect(appCheckMode({ VITE_APPCHECK_SITE_KEY: 'k' })).toBe('recaptcha');
  });

  it('is off in emulator mode without a debug token', () => {
    expect(appCheckMode({ VITE_USE_EMULATORS: 'true', VITE_APPCHECK_SITE_KEY: 'k' })).toBe('off');
  });

  it('uses the debug provider in emulator mode with a debug token', () => {
    expect(appCheckMode({ VITE_USE_EMULATORS: 'true', VITE_APPCHECK_SITE_KEY: 'k', VITE_APPCHECK_DEBUG_TOKEN: 'd' })).toBe('debug');
  });

  it('needs a site key even for a debug token', () => {
    expect(appCheckMode({ VITE_USE_EMULATORS: 'true', VITE_APPCHECK_DEBUG_TOKEN: 'd' })).toBe('off');
  });

  it('ignores the debug token when not using emulators', () => {
    expect(appCheckMode({ VITE_APPCHECK_SITE_KEY: 'k', VITE_APPCHECK_DEBUG_TOKEN: 'd' })).toBe('recaptcha');
  });

  it('uses the debug provider outside emulators only when debug is explicitly allowed', () => {
    const base = { VITE_APPCHECK_SITE_KEY: 'k', VITE_APPCHECK_DEBUG_TOKEN: 'd' };
    expect(appCheckMode({ ...base, VITE_APPCHECK_ALLOW_DEBUG: 'true' })).toBe('debug');
    expect(appCheckMode({ ...base, VITE_APPCHECK_ALLOW_DEBUG: 'false' })).toBe('recaptcha');
  });

  it('allowing debug without a token or site key does not enable it', () => {
    expect(appCheckMode({ VITE_APPCHECK_SITE_KEY: 'k', VITE_APPCHECK_ALLOW_DEBUG: 'true' })).toBe('recaptcha');
    expect(appCheckMode({ VITE_APPCHECK_DEBUG_TOKEN: 'd', VITE_APPCHECK_ALLOW_DEBUG: 'true' })).toBe('off');
  });
});
