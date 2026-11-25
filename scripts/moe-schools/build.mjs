// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAllSchools, parseNationalSchools } from '../../packages/core/src/moeParse.ts';

const [allPdf, nationalPdf] = process.argv.slice(2);
if (!allPdf || !nationalPdf) {
  console.error('Usage: pnpm moe:build <SchoolDetails.pdf> <NationalSchools.pdf>');
  process.exit(1);
}

const toText = (pdf) =>
  execFileSync('pdftotext', ['-layout', resolve(pdf), '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const all = parseAllSchools(toText(allPdf));
const national = parseNationalSchools(toText(nationalPdf));

if (all.length < 9000) throw new Error(`Only ${all.length} all-schools rows parsed; expected at least 9000`);
const allNos = new Set(all.map((r) => r.censusNo));
const seenNational = new Set();
for (const r of national) {
  if (seenNational.has(r.censusNo)) throw new Error(`Duplicate census number ${r.censusNo} in national list`);
  seenNational.add(r.censusNo);
  if (!allNos.has(r.censusNo)) throw new Error(`National census number ${r.censusNo} is missing from the all-schools list`);
}

const out = {};
for (const r of all) {
  if (out[r.censusNo]) throw new Error(`Duplicate census number ${r.censusNo} in all-schools list`);
  out[r.censusNo] = { n: r.name, a: r.address, l: r.level, g: r.span, m: r.medium, s: r.sex };
}

let added = 0;
for (const r of national) {
  const cur = out[r.censusNo];
  if (!cur) added++;
  out[r.censusNo] = {
    n: cur?.n ?? r.name,
    a: cur?.a ?? r.address,
    l: 'National',
    g: cur?.g ?? '',
    m: cur?.m ?? '',
    s: cur?.s ?? '',
    p: r.province,
    d: r.district,
    z: r.zone,
  };
}

const sorted = Object.fromEntries(Object.entries(out).sort(([x], [y]) => (x < y ? -1 : 1)));
const target = fileURLToPath(new URL('../../functions/src/data/moeSchools.json', import.meta.url));
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(sorted) + '\n');

const empty = all.filter((r) => !r.address).map((r) => r.censusNo);
const comma = all.filter((r) => r.name.includes(',')).map((r) => r.censusNo);
if (empty.length) console.warn(`WARN empty address: ${empty.join(', ')}`);
if (comma.length) console.warn(`WARN comma in name: ${comma.join(', ')}`);

const nationalCount = Object.values(sorted).filter((s) => s.l === 'National').length;
console.log(`all-schools rows: ${all.length}`);
console.log(`national-list rows: ${national.length} (${added} not in all-schools list)`);
console.log(`written: ${Object.keys(sorted).length} schools, ${nationalCount} national, ${statSync(target).size} bytes -> ${target}`);
