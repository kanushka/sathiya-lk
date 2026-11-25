// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { titleCase, toMoeSchool, type MoeFile, type MoeSchool, type SimilarCandidate } from '@sathiya/core';

export const MOE_FILE = 'moeSchools.json';

// Parsed on first use so cold starts of functions that never look up a census number skip the 1 MB parse.
// The bundle (lib/index.js) reads the copy build.mjs puts next to it; tests run from src read src/data.
let moe: MoeFile | undefined;
function load(): MoeFile {
  if (moe) return moe;
  const file = [join(__dirname, MOE_FILE), join(__dirname, '../data', MOE_FILE)].find((f) => existsSync(f));
  if (!file) throw new Error(`${MOE_FILE} not found next to ${__dirname}`);
  return (moe = JSON.parse(readFileSync(file, 'utf8')) as MoeFile);
}

export function moeSchool(censusNo: string): MoeSchool | undefined {
  const all = load();
  return Object.hasOwn(all, censusNo) ? toMoeSchool(censusNo, all[censusNo]!) : undefined;
}

let names: SimilarCandidate[] | undefined;

export const moeNames = (): SimilarCandidate[] => (names ??= Object.entries(load()).map(([id, e]) => ({ id, name: titleCase(e.n) })));
