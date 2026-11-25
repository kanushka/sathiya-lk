// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type JoinRequest, type Teacher } from '@sathiya/core';
import { db } from './admin';
import { fail } from './guards';
import { runTx } from './tx';

// Unknown and already-linked staff IDs fail identically, so a shared join link cannot be used to enumerate staff IDs.
export const staffIdUnusable = (): never => fail('failed-precondition', 'staff-id-unknown', 'This staff ID cannot be used to join');

export async function fileJoinRequest(sid: string, teacherId: string, req: Pick<JoinRequest, 'uid' | 'email' | 'name' | 'staffId'>): Promise<void> {
  const teacherRef = db.doc(`${paths.teachers(sid)}/${teacherId}`);
  await runTx(async (tx) => {
    const [teacher, own] = await Promise.all([tx.get(teacherRef), tx.get(db.collection(paths.teachers(sid)).where('uid', '==', req.uid).limit(1))]);
    const data = teacher.data() as Teacher | undefined;
    if (!data || data.staffId !== req.staffId || data.uid) staffIdUnusable();
    if (!own.empty) fail('failed-precondition', 'already-linked', 'This account is already linked to a teacher in this school', { reason: 'account' });
    const doc: JoinRequest = { ...req, teacherId, createdAt: Date.now(), status: 'pending' };
    tx.set(db.doc(`${paths.joinRequests(sid)}/${req.uid}`), doc);
  });
}
