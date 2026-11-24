// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Teacher } from '@sathiya/core';
import { db } from './admin';
import { fail } from './guards';
import { runTx } from './tx';

export async function createTeacherRecord(sid: string, teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'>): Promise<string> {
  const teachers = db.collection(paths.teachers(sid));
  const ref = teachers.doc();
  await runTx(async (tx) => {
    if (!(await tx.get(teachers.where('staffId', '==', teacher.staffId).limit(1))).empty) {
      fail('already-exists', 'invalid', `Staff ID ${teacher.staffId} is already used`, { field: 'staffId' });
    }
    tx.create(ref, teacher);
  });
  return ref.id;
}
