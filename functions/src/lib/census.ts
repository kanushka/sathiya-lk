// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { padCensusNo, paths } from '@sathiya/core';
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
