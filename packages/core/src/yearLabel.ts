// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export const YEAR_LABEL_RE = /^\d{4}$/;
export const YEAR_LABEL_RANGE = { min: 2000, max: 2100 } as const;

export function yearLabelError(label: string, existing: readonly string[]): 'format' | 'duplicate' | null {
  const l = label.trim();
  if (!YEAR_LABEL_RE.test(l) || Number(l) < YEAR_LABEL_RANGE.min || Number(l) > YEAR_LABEL_RANGE.max) return 'format';
  return existing.some((e) => e.trim() === l) ? 'duplicate' : null;
}
