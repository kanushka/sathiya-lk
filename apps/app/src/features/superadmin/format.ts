// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export function formatDate(ms: number, lang: string): string {
  return new Date(ms).toLocaleDateString(lang === 'si' ? 'si-LK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatActivity(v: number | null | 'error', lang: string, never: string, unknown: string): string {
  if (v === 'error') return unknown;
  return v ? formatDate(v, lang) : never;
}
