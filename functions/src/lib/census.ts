// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { padCensusNo, paths } from '@sathiya/core';
import { FieldValue, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { db } from './admin';

// Index docs written before padding used the number as typed, so a 4-digit form of a padded number still counts as taken.
export const legacyCensusKeys = (censusNo: string): string[] => {
  const padded = padCensusNo(censusNo);
  return padded.length === 5 && padded.startsWith('0') ? [padded.slice(1)] : [];
};

export async function censusTaken(censusNo: string): Promise<boolean> {
  const refs = [padCensusNo(censusNo), ...legacyCensusKeys(censusNo)].map((k) => db.doc(paths.censusIndex(k)));
  return (await db.getAll(...refs)).some((d) => d.exists);
}

// Call after every other read in the transaction: it reads the index doc, then writes.
export async function releaseCensus(tx: Transaction, school: DocumentSnapshot, uid: string): Promise<{ censusNo: string; freed: boolean } | undefined> {
  const censusNo = school.get('censusNo') as string | undefined;
  if (!censusNo) return undefined;
  const indexRef = db.doc(paths.censusIndex(censusNo));
  const index = await tx.get(indexRef);
  const freed = index.exists && index.get('schoolId') === school.id;
  if (freed) tx.delete(indexRef);
  tx.update(school.ref, { censusNo: FieldValue.delete(), releasedCensusNo: censusNo, censusReleasedAt: Date.now(), censusReleasedBy: uid });
  return { censusNo, freed };
}
