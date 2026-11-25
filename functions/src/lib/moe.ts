// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { titleCase, toMoeSchool, type MoeFile, type MoeSchool, type SimilarCandidate } from '@sathiya/core';
import data from '../data/moeSchools.json';

const MOE = data as MoeFile;

export function moeSchool(censusNo: string): MoeSchool | undefined {
  return Object.hasOwn(MOE, censusNo) ? toMoeSchool(censusNo, MOE[censusNo]!) : undefined;
}

let names: SimilarCandidate[] | undefined;

export const moeNames = (): SimilarCandidate[] => (names ??= Object.entries(MOE).map(([id, e]) => ({ id, name: titleCase(e.n) })));
