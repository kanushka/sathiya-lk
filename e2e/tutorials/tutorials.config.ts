// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { defineConfig, devices } from '@playwright/test';
import base from '../playwright.config';
import { WEB_URL, type Lang } from './kit';

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 };
const app = [base.webServer].flat().filter((s) => s !== undefined);

export default defineConfig<{ lang: Lang }>({
  ...base,
  testDir: './flows',
  testMatch: '*.tutorial.ts',
  globalSetup: '../global-setup.ts',
  timeout: 300_000,
  reporter: 'list',
  use: { ...base.use, ...desktop, trace: 'off', screenshot: 'off' },
  projects: [
    { name: 'en', use: { ...desktop, lang: 'en' } },
    { name: 'si', use: { ...desktop, lang: 'si' } },
  ],
  webServer: [
    ...app,
    {
      command: './node_modules/.bin/astro build && exec python3 -m http.server 4322 --bind :: --directory dist',
      cwd: new URL('../../apps/web/', import.meta.url).pathname,
      url: `${WEB_URL}/`,
      env: { PUBLIC_APP_URL: base.use?.baseURL ?? 'http://localhost:4173' },
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
