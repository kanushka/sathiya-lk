// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { placePopover } from './popoverPlacement';

const anchor = (top: number, bottom = top + 44) => ({ top, bottom, left: 40, width: 300 });

describe('placePopover', () => {
  it('opens below the anchor when it fits', () => {
    const p = placePopover({ anchor: anchor(100), contentHeight: 300, viewportHeight: 800 });
    expect(p).toMatchObject({ placement: 'below', top: 150, left: 40, width: 300, maxHeight: 300 });
  });

  it('flips above when below is too tight and above has more room', () => {
    const p = placePopover({ anchor: anchor(600), contentHeight: 300, viewportHeight: 700 });
    expect(p.placement).toBe('above');
    expect(p.top).toBe(600 - 6 - 300);
    expect(p.maxHeight).toBe(300);
  });

  it('stays below and clamps height when neither side fits but below is larger', () => {
    const p = placePopover({ anchor: anchor(200), contentHeight: 900, viewportHeight: 600 });
    expect(p.placement).toBe('below');
    expect(p.maxHeight).toBe(600 - 244 - 6 - 8);
  });

  it('flips above and clamps height when above is the larger side', () => {
    const p = placePopover({ anchor: anchor(400), contentHeight: 900, viewportHeight: 520 });
    expect(p.placement).toBe('above');
    expect(p.maxHeight).toBe(400 - 6 - 8);
    expect(p.top).toBe(8);
  });
});
