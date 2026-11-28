// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
// Adds a fictional school (one census number per tutorial language) to the emulator's built copy of the MOE list, so tutorials never show a real school.
// functions predeploy rebuilds lib/, which drops this entry again.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../../functions/lib/moeSchools.json', import.meta.url);
const moe = JSON.parse(readFileSync(file, 'utf8'));
const demo = {
  n: 'SATHIYA DEMO COLLEGE',
  a: 'TEMPLE ROAD, KANDY',
  l: 'Provincial',
  g: 'Grd 6-13',
  m: 'S/E',
  s: 'Mixed',
  p: 'Central',
  d: 'Kandy',
  z: 'Kandy',
};
for (let n = 99960; n <= 99999; n++) moe[String(n)] = demo;
writeFileSync(file, JSON.stringify(moe));
