// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { isInAppBrowser } from './inAppBrowser';

describe('isInAppBrowser', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.29.109]', true],
    ['Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/447.0.0.0.0;]', true],
    ['Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/119.0 Mobile Safari/537.36 Instagram 309.0.0.40.113 Android', true],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Messenger/430.0', true],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', false],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', false],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', false],
    ['', false],
  ])('%s → %s', (ua, expected) => {
    expect(isInAppBrowser(ua)).toBe(expected);
  });
});
