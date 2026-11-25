// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DocumentReference } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './admin';
import { fail } from './guards';
import { runTx } from './tx';

export const APPLY_TIMEOUT_S = 300;
export const APPLY_LEASE_MS = (APPLY_TIMEOUT_S + 30) * 1000;

export function assertNotApplying(year: { get(field: string): unknown }): void {
  const until = year.get('applyingUntil');
  if (typeof until === 'number' && until > Date.now()) fail('failed-precondition', 'busy', 'An auto-fill is being saved to this timetable');
}

export async function acquireLease(yearRef: DocumentReference): Promise<number> {
  return runTx(async (tx) => {
    const year = await tx.get(yearRef);
    if (!year.exists) fail('invalid-argument', 'invalid', 'Unknown year');
    assertNotApplying(year);
    const until = Date.now() + APPLY_LEASE_MS;
    tx.update(yearRef, { applyingUntil: until });
    return until;
  });
}

export async function releaseLease(yearRef: DocumentReference, until: number): Promise<void> {
  await db.runTransaction(async (tx) => {
    if ((await tx.get(yearRef)).get('applyingUntil') === until) tx.update(yearRef, { applyingUntil: FieldValue.delete() });
  });
}
