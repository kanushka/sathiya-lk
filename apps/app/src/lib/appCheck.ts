// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export type AppCheckMode = 'off' | 'debug' | 'recaptcha';

export interface AppCheckEnv {
  VITE_USE_EMULATORS?: string;
  VITE_APPCHECK_SITE_KEY?: string;
  VITE_APPCHECK_DEBUG_TOKEN?: string;
}

export function appCheckMode(env: AppCheckEnv): AppCheckMode {
  if (!env.VITE_APPCHECK_SITE_KEY) return 'off';
  if (env.VITE_USE_EMULATORS === 'true') return env.VITE_APPCHECK_DEBUG_TOKEN ? 'debug' : 'off';
  return 'recaptcha';
}
