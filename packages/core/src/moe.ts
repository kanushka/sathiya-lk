// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export type MoeLevel = 'National' | 'Provincial';
export type MoeSex = 'Boys' | 'Girls' | 'Mixed';
export type MoeLang = 'si' | 'ta' | 'en';

export interface MoeSchool {
  censusNo: string;
  name: string;
  address: string;
  level: MoeLevel;
  grades: number[];
  media: MoeLang[];
  sex: MoeSex;
  province?: string;
  district?: string;
  zone?: string;
}

export interface MoeEntry {
  n: string;
  a: string;
  l: string;
  g: string;
  m: string;
  s: string;
  p?: string;
  d?: string;
  z?: string;
}

export type MoeFile = Record<string, MoeEntry>;

const MEDIUM_LANG: Record<string, MoeLang> = { S: 'si', T: 'ta', E: 'en' };

export function parseGradeSpan(span: string): number[] {
  const dash = span.lastIndexOf('-');
  if (dash < 0) return [];
  const left = span.slice(0, dash).trimEnd();
  const right = span.slice(dash + 1).trim();
  let start = left.length;
  while (start > 0 && left[start - 1]! >= '0' && left[start - 1]! <= '9') start--;
  if (start === left.length || !/^\d+$/.test(right)) return [];
  const from = Number(left.slice(start));
  const to = Number(right);
  if (from > to) return [];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function parseMedium(medium: string): MoeLang[] {
  const out: MoeLang[] = [];
  for (const part of medium.replace(/^\d+\./, '').split('/')) {
    const lang = MEDIUM_LANG[part.trim().toUpperCase()];
    if (lang && !out.includes(lang)) out.push(lang);
  }
  return out;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function titleCase(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((token) =>
      token
        .split(/([.\-'’()/,])/)
        .map((seg) => (seg.length === 1 ? seg.toUpperCase() : /[A-Za-z]/.test(seg) ? capitalize(seg) : seg))
        .join('')
        .replace(/'S\b/g, "'s"),
    )
    .join(' ');
}

export function toMoeSchool(censusNo: string, e: MoeEntry): MoeSchool {
  return {
    censusNo,
    name: titleCase(e.n),
    address: e.a,
    level: e.l as MoeLevel,
    grades: parseGradeSpan(e.g),
    media: parseMedium(e.m),
    sex: e.s as MoeSex,
    ...(e.p ? { province: e.p } : {}),
    ...(e.d ? { district: e.d } : {}),
    ...(e.z ? { zone: e.z } : {}),
  };
}
