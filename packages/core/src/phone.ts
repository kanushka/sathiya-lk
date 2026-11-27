// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { PHONE_RE } from './importValidate';

export const PHONE_MAX = 30;

/**
 * A teacher's own phone number as typed: '' clears it, anything else must look like a phone number.
 * Returns the trimmed number with runs of spaces collapsed, null to clear, or undefined when it is not valid.
 */
export function cleanPhone(v: unknown): string | null | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().replace(/\s+/g, ' ');
  if (s === '') return null;
  if (s.length > PHONE_MAX || !PHONE_RE.test(s)) return undefined;
  return s;
}
