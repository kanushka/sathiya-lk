// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { buildSlipsHtml } from './printSlips';
import { slipText, teacherLoginUrl, whatsappUrl } from './slip';

const labels = { staffId: 'Staff ID', password: 'Password', resetNeeded: 'Reset needed', loginAt: 'Log in at', heading: 'h', hint: 'x', title: 'Slips' };
const slip = { schoolName: 'Siripura Central College', staffId: 'SCC024', name: 'Mrs. N. Perera', url: 'https://app.test/login?as=teacher&school=siripura' };

describe('slip helpers', () => {
  it('builds the login url', () => {
    expect(teacherLoginUrl('https://app.test', 'siripura')).toBe(slip.url);
  });

  it('builds slip text with password or reset notice', () => {
    expect(slipText({ ...slip, password: 'k7m4x9pq' }, labels)).toContain('Password: k7m4x9pq');
    expect(slipText(slip, labels)).toContain('Password: Reset needed');
  });

  it('encodes the WhatsApp link', () => {
    expect(whatsappUrl('a b\nc')).toBe('https://wa.me/?text=a%20b%0Ac');
  });

  it('builds print html with escaped values', () => {
    const html = buildSlipsHtml(
      [{ ...slip, name: '<b>x</b>', password: 'k7m4x9pq' }, slip],
      ['data:a', 'data:b'],
      labels,
    );
    expect(html).toContain('k7m4x9pq');
    expect(html).toContain('Reset needed');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
    expect(html.match(/<article>/g)).toHaveLength(2);
  });
});
