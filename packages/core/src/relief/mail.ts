// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Relief } from '../types';

export function reliefKey(reliefs: Relief[], teacherId: string): string {
  return reliefs
    .filter((r) => r.reliefTeacherId === teacherId)
    .map((r) => r.entryId)
    .sort()
    .join(',');
}

export function planReliefMail(current: string, last: string | undefined): 'assigned' | 'cancelled' | null {
  if (current === (last ?? '')) return null;
  if (current === '') return 'cancelled';
  return 'assigned';
}
