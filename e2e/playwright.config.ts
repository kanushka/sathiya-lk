// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const external = process.env.E2E_BASE_URL;
const appEnv = { VITE_USE_EMULATORS: 'true', VITE_APPCHECK_SITE_KEY: '', VITE_APPCHECK_DEBUG_TOKEN: '' };

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: external
    ? undefined
    : {
        command: `pnpm --filter app exec vite build --outDir dist-e2e --emptyOutDir && pnpm --filter app exec vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/login`,
        env: appEnv,
        timeout: 180_000,
        reuseExistingServer: false,
      },
});
