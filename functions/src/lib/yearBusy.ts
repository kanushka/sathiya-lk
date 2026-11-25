// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { fail } from './guards';

export const APPLY_LEASE_MS = 120_000;

export function assertNotApplying(year: { get(field: string): unknown }): void {
  const until = year.get('applyingUntil');
  if (typeof until === 'number' && until > Date.now()) fail('failed-precondition', 'busy', 'An auto-fill is being saved to this timetable');
}
