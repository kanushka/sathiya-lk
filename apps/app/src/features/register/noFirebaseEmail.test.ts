// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [p] : [];
  });
}

describe('auth emails', () => {
  it('no feature calls the Firebase client email senders', () => {
    const offenders = sources(join(__dirname, '..')).filter((f) =>
      /sendEmailVerification|sendPasswordResetEmail/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
