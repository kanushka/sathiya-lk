// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

const KEPT = ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl'] as const;

// The console can refuse a custom action URL on new projects (EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED), so Admin SDK links point at
// Firebase's hosted handler; rebuild them on the app's own /auth/action page.
export function appActionLink(generated: string, appUrl: string): string {
  const params = new URL(generated).searchParams;
  if (!params.get('mode') || !params.get('oobCode')) throw new Error('action link has no mode or oobCode');
  const query = KEPT.flatMap((k) => {
    const v = params.get(k);
    return v ? [`${k}=${encodeURIComponent(v)}`] : [];
  }).join('&');
  return `${appUrl.replace(/\/+$/, '')}/auth/action?${query}`;
}
