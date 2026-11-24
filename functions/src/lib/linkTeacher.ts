// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Member, type Teacher } from '@sathiya/core';
import type { Transaction } from 'firebase-admin/firestore';
import { db } from './admin';
import { fail } from './guards';

const alreadyLinked = (message: string): never => fail('failed-precondition', 'already-linked', message);

export interface LinkOpts {
  role?: 'admin';
  email?: string;
  name?: string;
}

// The caller runs syncClaims(uid) after the transaction commits.
export async function linkTeacher(tx: Transaction, sid: string, teacherId: string, uid: string, opts: LinkOpts = {}): Promise<void> {
  const teacherRef = db.doc(`${paths.teachers(sid)}/${teacherId}`);
  const memberRef = db.doc(`${paths.members(sid)}/${uid}`);
  const [teacher, own, member, requests] = await Promise.all([
    tx.get(teacherRef),
    tx.get(db.collection(paths.teachers(sid)).where('uid', '==', uid).limit(1)),
    tx.get(memberRef),
    tx.get(db.collection(paths.joinRequests(sid)).where('teacherId', '==', teacherId)),
  ]);
  if (!teacher.exists) fail('not-found', 'invalid', 'Teacher not found');
  if ((teacher.data() as Teacher).uid) alreadyLinked('This teacher is already linked to an account');
  if (!own.empty) alreadyLinked('This account is already linked to a teacher in this school');

  const existing = member.data() as Member | undefined;
  const role = opts.role === 'admin' || existing?.role === 'admin' ? 'admin' : 'teacher';
  tx.update(teacherRef, { uid });
  tx.set(
    memberRef,
    { uid, role, teacherId, ...(opts.email && { email: opts.email }), ...(opts.name && !existing?.name && { name: opts.name }) },
    { merge: true },
  );
  requests.docs.forEach((d) => tx.delete(d.ref));
}
