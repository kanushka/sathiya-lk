// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const core = (f) => fileURLToPath(new URL(`../packages/core/src/${f}`, import.meta.url));

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions'],
  alias: { '@sathiya/core/fixtures': core('fixtures.ts'), '@sathiya/core': core('index.ts') },
  logLevel: 'warning',
});

copyFileSync('src/data/moeSchools.json', 'lib/moeSchools.json');
