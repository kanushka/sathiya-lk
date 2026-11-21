// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Block {
  source: string;
  headers: { key: string; value: string }[];
}
const config = JSON.parse(readFileSync(join(__dirname, '../../../../firebase.json'), 'utf8')) as {
  hosting: { target: string; headers: Block[]; predeploy?: string[] }[];
  functions: { source: string; ignore: string[] }[];
};

describe('app hosting deploy', () => {
  it('runs the App Check site key check before upload', () => {
    expect(config.hosting.find((h) => h.target === 'app')!.predeploy).toContain('node apps/app/deploy/check-app-check.mjs');
  });
});

describe('functions deploy', () => {
  it('keeps the CLI default ignores that a custom list replaces', () => {
    const ignore = config.functions.find((f) => f.source === 'functions')!.ignore;
    for (const pattern of ['node_modules', '.git', 'firebase-debug.log', 'firebase-debug.*.log', '*.local']) {
      expect(ignore, pattern).toContain(pattern);
    }
  });
});

describe.each([
  ['web', '/_astro/**'],
  ['app', '/assets/**'],
])('%s hosting headers', (target, assets) => {
  const blocks = config.hosting.find((h) => h.target === target)!.headers;
  const value = (b: Block | undefined, key: string) => b?.headers.find((h) => h.key === key)?.value;

  it('defaults every path to no-cache with the security headers', () => {
    const all = blocks.find((b) => b.source === '**');
    expect(value(all, 'Cache-Control')).toBe('no-cache');
    for (const key of ['X-Frame-Options', 'Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Strict-Transport-Security', 'Permissions-Policy']) {
      expect(value(all, key), key).toBeTruthy();
    }
  });

  it('caches hashed assets immutably in a later block, which overrides the default', () => {
    const all = blocks.findIndex((b) => b.source === '**');
    const asset = blocks.findIndex((b) => b.source === assets);
    expect(asset).toBeGreaterThan(all);
    expect(value(blocks[asset], 'Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('does not set Cross-Origin-Opener-Policy', () => {
    expect(blocks.flatMap((b) => b.headers).some((h) => h.key === 'Cross-Origin-Opener-Policy')).toBe(false);
  });
});
