// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config';

describe('fill colour tokens', () => {
  it('exposes the fill-strength colours', () => {
    const colors = tailwindConfig.theme?.extend?.colors as unknown as Record<string, Record<string, string>>;
    expect(colors.fill).toEqual({ warning: '#D9A441', 'warning-strong': '#B7831F', success: '#2E8B4A', over: '#F2994A' });
  });
});
