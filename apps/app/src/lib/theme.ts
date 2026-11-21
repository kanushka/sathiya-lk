// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { onColor } from '@sathiya/core';

export interface BrandColors {
  primary: string;
  second: string;
}

export const sathiyaBrand: BrandColors = { primary: '#0E6B6A', second: '#F2A541' };

export function applyBrand(colors: BrandColors): void {
  const style = document.documentElement.style;
  style.setProperty('--brand', colors.primary);
  style.setProperty('--brand-2', colors.second);
  style.setProperty('--on-brand', onColor(colors.primary));
}

export function applyDefaultBrand(): void {
  applyBrand(sathiyaBrand);
}
