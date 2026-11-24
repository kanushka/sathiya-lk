// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

const IN_APP = /\bFBAN\b|\bFBAV\b|\bInstagram\b|\bMessenger\b/;

export function isInAppBrowser(ua: string): boolean {
  return IN_APP.test(ua);
}
