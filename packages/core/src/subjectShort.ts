// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { STANDARD_SUBJECTS } from './standardSubjects';

const STOP = new Set(['and', 'of', 'the', 'for', 'in']);

const normalize = (name: string) => name.toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();

const KNOWN = new Map<string, string>([
  ...STANDARD_SUBJECTS.map((s): [string, string] => [normalize(s.nameEn), s.short]),
  ['maths', 'Math'],
  ['music', 'Mus'],
  ['dance', 'Dnc'],
  ['drama', 'Dra'],
]);

const latinWords = (name: string) =>
  name
    .split(/[\s&/,\-]+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter((w) => w !== '' && !STOP.has(w.toLowerCase()));

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

const key = (short: string) => short.trim().toLowerCase();

export function shortTaken(short: string, existing: readonly string[]): boolean {
  const k = key(short);
  return k !== '' && existing.some((e) => key(e) === k);
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export function nameTaken(name: string, existing: readonly (string | undefined)[]): boolean {
  const k = nameKey(name);
  return k !== '' && existing.some((e) => nameKey(e ?? '') === k);
}

export function suggestSubjectShort(nameEn: string, existing: readonly string[]): string {
  const words = latinWords(nameEn);
  if (words.length === 0) return '';
  const known = KNOWN.get(normalize(nameEn));
  const single = words.length === 1 ? words[0]! : null;
  const base =
    known ??
    (single
      ? capital(single.length <= 4 ? single : single.slice(0, 3))
      : words
          .slice(0, 4)
          .map((w) => w[0]!.toUpperCase())
          .join(''));
  const candidates = [base];
  if (single && base.length < 4 && single.length > base.length) candidates.push(capital(single.slice(0, base.length + 1)));
  for (const c of candidates) if (!shortTaken(c, existing)) return c;
  for (let n = 2; ; n++) if (!shortTaken(`${base}${n}`, existing)) return `${base}${n}`;
}
