// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SPDX = 'SPDX-License-Identifier: AGPL-3.0-or-later';
const source = /\.(ts|tsx|js|mjs|cjs|css|html|astro|rules)$/;
const skip = /(^|\/)(dist|node_modules|\.astro)\//;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => source.test(f) && !skip.test(f));

const missing = files.filter((f) => !readFileSync(f, 'utf8').split('\n').slice(0, 5).some((l) => l.includes(SPDX)));

if (missing.length) {
  console.error(`Missing "${SPDX}" header:\n${missing.map((f) => `  ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`License headers OK (${files.length} files).`);
