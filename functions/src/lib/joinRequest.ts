// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type JoinRequest, type Teacher } from '@sathiya/core';
import { db } from './admin';
import { fail } from './guards';
import { runTx } from './tx';

export async function fileJoinRequest(sid: string, teacherId: string, req: Pick<JoinRequest, 'uid' | 'email' | 'name' | 'staffId'>): Promise<void> {
  const teacherRef = db.doc(`${paths.teachers(sid)}/${teacherId}`);
  await runTx(async (tx) => {
    const [teacher, own] = await Promise.all([tx.get(teacherRef), tx.get(db.collection(paths.teachers(sid)).where('uid', '==', req.uid).limit(1))]);
    const data = teacher.data() as Teacher | undefined;
    if (!data || data.staffId !== req.staffId) fail('failed-precondition', 'staff-id-unknown', 'No teacher has this staff ID');
    if (data!.uid) fail('failed-precondition', 'already-linked', 'This teacher is already linked to an account', { reason: 'teacher' });
    if (!own.empty) fail('failed-precondition', 'already-linked', 'This account is already linked to a teacher in this school', { reason: 'account' });
    const doc: JoinRequest = { ...req, teacherId, createdAt: Date.now(), status: 'pending' };
    tx.set(db.doc(`${paths.joinRequests(sid)}/${req.uid}`), doc);
  });
}
