// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';

// Vitest stubs CSS imports (even ?raw) to '', so read the file from disk; the app has no @types/node.
async function readCss(): Promise<string> {
  const fsModule: string = 'node:fs';
  const fs = (await import(/* @vite-ignore */ fsModule)) as { readFileSync(path: string, encoding: 'utf8'): string };
  return fs.readFileSync(decodeURIComponent(import.meta.url.replace(/^file:\/\//, '').replace(/[^/]+$/, 'print.css')), 'utf8');
}

describe('print.css', () => {
  it('sets A4 landscape only on the named sheet page', async () => {
    const css = await readCss();
    expect(css).not.toMatch(/@page\s*\{/);
    expect(css).toMatch(/@page\s+sheet\s*\{[^}]*size:\s*A4 landscape;[^}]*margin:\s*10mm;/);
    expect(css).toMatch(/\.print-sheet\s*\{[^}]*page:\s*sheet;/);
  });
});
