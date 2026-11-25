// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { CENSUS_NO_RE } from './census';

export interface AllSchoolRow {
  censusNo: string;
  name: string;
  address: string;
  level: string;
  span: string;
  medium: string;
  sex: string;
}

export interface NationalSchoolRow {
  censusNo: string;
  name: string;
  address: string;
  province: string;
  district: string;
  zone: string;
}

const TAIL = /(National|Provincial)\s+(\d\.Grd\s*\d+-\d+)\s+(\d\.[A-Z/]+)\s+(\d\.(?:Boys|Girls|Mixed))\s*$/;
const HEADER = /School Name 2023|2023 Year|Census No|SCHOOL_|^\s*(2023|LEVEL)\s*$|List of National Schools/;
const ALL_START = /^\s{0,3}(\d+)(?:\s|$)/;
const NAT_START = /^\s*\d+\s+(\d+)\s/;
const NAT_COLS = /(\d\.[A-Za-z][A-Za-z ]*?)\s{2,}(\d{2}\.[A-Za-z][A-Za-z ]*?)\s{2,}(\S.*?)\s*$/;

const stripNum = (s: string) => s.replace(/^\d+\.\s*/, '').trim();
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function cells(line: string): { at: number; text: string }[] {
  return [...line.matchAll(/\S+(?: \S+)*/g)].map((m) => ({ at: m.index ?? 0, text: m[0] }));
}

function mode(xs: number[]): number {
  const count = new Map<number, number>();
  for (const x of xs) count.set(x, (count.get(x) ?? 0) + 1);
  let best = -1;
  let bestN = 0;
  for (const [x, c] of count) if (c > bestN) [best, bestN] = [x, c];
  return best;
}

function checkCensus(no: string, line: string): string {
  if (!CENSUS_NO_RE.test(no)) throw new Error(`Census number "${no}" is not 4-6 digits: ${line.trim()}`);
  return no;
}

function pages(text: string): string[][] {
  return text.split('\f').map((p) => p.split('\n').filter((l) => l.trim() && !HEADER.test(l)));
}

const grp = (m: RegExpExecArray, i: number) => m[i] ?? '';

function addressStart(cs: { at: number; text: string }[], l: string): number {
  return ALL_START.test(l) && cs.length >= 3 ? (cs[2]?.at ?? -1) : -1;
}

function splitLine(body: string, addrCol: number): { name: string[]; address: string[]; addrCol: number } {
  const cs = cells(body);
  const last = cs[cs.length - 1];
  if (!last) return { name: [], address: [], addrCol };
  if (cs.length >= 2) {
    return { name: cs.slice(0, -1).map((c) => c.text), address: [last.text], addrCol: last.at };
  }
  const nearest = [...last.text.matchAll(/\S+/g)]
    .filter((w) => w.index && Math.abs(last.at + w.index - addrCol) <= 3)
    .sort((x, y) => Math.abs(last.at + (x.index ?? 0) - addrCol) - Math.abs(last.at + (y.index ?? 0) - addrCol))[0]?.index;
  if (nearest !== undefined) return { name: [last.text.slice(0, nearest)], address: [last.text.slice(nearest)], addrCol };
  return last.at >= addrCol - 3 ? { name: [], address: [last.text], addrCol } : { name: [last.text], address: [], addrCol };
}

export function parseAllSchools(text: string): AllSchoolRow[] {
  const rows: AllSchoolRow[] = [];
  for (const page of pages(text)) {
    let addrCol = mode(page.map((l) => addressStart(cells(l.replace(TAIL, '')), l)).filter((x) => x >= 0));
    let buf: string[] = [];
    for (const line of page) {
      buf.push(line);
      const t = TAIL.exec(line);
      if (!t) continue;
      const name: string[] = [];
      const address: string[] = [];
      let censusNo = '';
      for (const l of buf) {
        const m = ALL_START.exec(l);
        let body = l.replace(TAIL, '');
        if (m) {
          censusNo = checkCensus(grp(m, 1), l);
          body = body.replace(grp(m, 1), ' '.repeat(grp(m, 1).length));
        }
        const part = splitLine(body, addrCol);
        addrCol = part.addrCol;
        name.push(...part.name);
        address.push(...part.address);
      }
      if (!censusNo) throw new Error(`No census number in row: ${buf.join(' | ')}`);
      rows.push({
        censusNo,
        name: clean(name.join(' ')),
        address: clean(address.join(' ')),
        level: grp(t, 1),
        span: clean(grp(t, 2).replace(/^\d\./, '')),
        medium: stripNum(grp(t, 3)),
        sex: stripNum(grp(t, 4)),
      });
      buf = [];
    }
    if (buf.length) throw new Error(`Unparsed lines: ${buf.join(' | ')}`);
  }
  return rows;
}

export function parseNationalSchools(text: string): NationalSchoolRow[] {
  const rows: NationalSchoolRow[] = [];
  for (const page of pages(text)) {
    let pending: string[] = [];
    for (const line of page) {
      const m = NAT_START.exec(line);
      if (!m) {
        pending.push(line.trim());
        continue;
      }
      const censusNo = checkCensus(grp(m, 1), line);
      const rest = line.slice(m[0].length - 1);
      const cols = NAT_COLS.exec(rest);
      if (!cols) throw new Error(`Cannot find province/district/zone: ${line.trim()}`);
      const left = cells(rest.slice(0, cols.index)).map((c) => c.text);
      if (left.length < 2) throw new Error(`Cannot split name and address: ${line.trim()}`);
      rows.push({
        censusNo,
        name: clean(left[0] ?? ''),
        address: clean([...pending, ...left.slice(1)].join(' ')),
        province: stripNum(grp(cols, 1)),
        district: stripNum(grp(cols, 2)),
        zone: clean(grp(cols, 3)),
      });
      pending = [];
    }
    if (pending.length) throw new Error(`Unparsed lines: ${pending.join(' | ')}`);
  }
  return rows;
}
