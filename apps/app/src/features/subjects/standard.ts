// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { STANDARD_SUBJECTS, shortTaken, suggestSubjectShort, type Subject } from '@sathiya/core';
import type { SubjectInput } from './api';

const key = (s: string) => s.trim().toLowerCase();

export function standardList(platform: SubjectInput[] | undefined): readonly SubjectInput[] {
  return platform && platform.length > 0 ? platform : STANDARD_SUBJECTS;
}

function uniqueShort(d: SubjectInput, taken: readonly string[]): string {
  if (!shortTaken(d.short, taken)) return d.short;
  const suggested = suggestSubjectShort(d.nameEn, taken);
  if (suggested) return suggested;
  for (let n = 2; ; n++) if (!shortTaken(`${d.short.trim()}${n}`, taken)) return `${d.short.trim()}${n}`;
}

export function missingDefaults(existing: Pick<Subject, 'nameEn' | 'short'>[] | Pick<Subject, 'nameEn'>[], defaults: readonly SubjectInput[]): SubjectInput[] {
  const seen = new Set(existing.map((s) => key(s.nameEn)));
  const aliases = new Set(existing.map((s) => key(suggestSubjectShort(s.nameEn, []))).filter(Boolean));
  const shorts = existing.flatMap((s) => ('short' in s ? [s.short] : []));
  const out: SubjectInput[] = [];
  for (const d of defaults) {
    const k = key(d.nameEn);
    if (!k || seen.has(k) || aliases.has(key(d.short))) continue;
    seen.add(k);
    const short = uniqueShort(d, shorts);
    shorts.push(short);
    out.push(short === d.short ? d : { ...d, short });
  }
  return out;
}
