// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { BUILD_ENV_FILE, buildEnvInfo } from './deploy/appCheckGuard.mjs';

function buildEnvFile(): Plugin {
  let info = buildEnvInfo('production', {});
  return {
    name: 'sathiya-build-env',
    apply: 'build',
    configResolved(config) {
      info = buildEnvInfo(config.mode, config.env);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: BUILD_ENV_FILE, source: `${JSON.stringify(info)}\n` });
    },
  };
}

export default defineConfig({
  plugins: [react(), buildEnvFile()],
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|@remix-run|scheduler)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  test: {
    name: 'app',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
