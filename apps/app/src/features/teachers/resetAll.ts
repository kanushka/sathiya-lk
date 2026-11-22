// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { resetTeacherPassword } from './api';

const CONCURRENCY = 5;

export interface ResetAllResult {
  passwords: Record<string, string>;
  failed: number;
}

export async function resetPasswords(schoolId: string, teacherIds: string[]): Promise<ResetAllResult> {
  const passwords: Record<string, string> = {};
  let failed = 0;
  let next = 0;
  async function worker() {
    while (next < teacherIds.length) {
      const id = teacherIds[next++]!;
      try {
        passwords[id] = await resetTeacherPassword(schoolId, id);
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, teacherIds.length) }, worker));
  return { passwords, failed };
}
