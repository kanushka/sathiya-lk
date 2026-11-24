// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';

const css = readFileSync(join(import.meta.dirname, 'index.css'), 'utf8');

describe('safe areas', () => {
  it('lets the page draw under the home bar so env(safe-area-inset-*) takes effect', () => {
    expect(html).toMatch(/<meta name="viewport" content="[^"]*viewport-fit=cover/);
  });

  it('keeps content clear of side notches in landscape', () => {
    expect(css).toMatch(/body\s*{[^}]*padding-left:\s*env\(safe-area-inset-left\)/);
    expect(css).toMatch(/body\s*{[^}]*padding-right:\s*env\(safe-area-inset-right\)/);
  });
});
