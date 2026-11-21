// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_EMULATORS?: string;
  readonly VITE_FUNCTIONS_REGION?: string;
  readonly VITE_APPCHECK_SITE_KEY?: string;
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_APPCHECK_ALLOW_DEBUG?: string;
  readonly VITE_FIREBASE_ENV?: string;
  readonly VITE_WEB_URL?: string;
}
