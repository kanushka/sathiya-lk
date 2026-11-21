import { describe, expect, it } from 'vitest';
import { appCheckEnforced } from '../src/lib/callOptions';
import { newPassword, PASSWORD_ALPHABET } from '../src/lib/password';

describe('appCheckEnforced', () => {
  it('is on by default and off in the emulator or when switched off', () => {
    expect(appCheckEnforced({})).toBe(true);
    expect(appCheckEnforced({ ENFORCE_APP_CHECK: 'true' })).toBe(true);
    expect(appCheckEnforced({ FUNCTIONS_EMULATOR: 'true' })).toBe(false);
    expect(appCheckEnforced({ ENFORCE_APP_CHECK: 'false' })).toBe(false);
  });
});

describe('newPassword', () => {
  it('is 8 characters from the look-alike-free alphabet', () => {
    expect(PASSWORD_ALPHABET).toBe('abcdefghjkmnpqrstuvwxyz23456789');
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pw = newPassword();
      expect(pw).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
      for (const ch of pw) seen.add(ch);
    }
    expect(seen.size).toBeGreaterThan(25);
  });
});
