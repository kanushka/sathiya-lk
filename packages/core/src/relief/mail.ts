// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Relief } from '../types';

const dutyKey = (r: Relief): string => JSON.stringify([r.entryId, r.absentTeacherId, r.start, r.end, r.period, r.classIds, r.subjectId]);

export function reliefKey(reliefs: Relief[], teacherId: string): string {
  return reliefs
    .filter((r) => r.reliefTeacherId === teacherId)
    .map(dutyKey)
    .sort()
    .join(',');
}

export function planReliefMail(current: string, last: string | undefined): 'assigned' | 'cancelled' | null {
  if (current === (last ?? '')) return null;
  if (current === '') return 'cancelled';
  return 'assigned';
}
