// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [p] : [];
  });
}

describe('danger colour', () => {
  it('is defined once as a CSS variable and exposed as a Tailwind colour', () => {
    expect(readFileSync(join(__dirname, '../index.css'), 'utf8')).toMatch(/--danger:\s*#a3262a/i);
    expect(readFileSync(join(__dirname, '../../tailwind.config.ts'), 'utf8')).toContain('var(--danger) calc(<alpha-value> * 100%)');
  });

  it('is never hard-coded in components', () => {
    const offenders = sources(join(__dirname, '..')).filter((f) => /#A3262A/i.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
