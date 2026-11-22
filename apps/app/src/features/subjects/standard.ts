// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { STANDARD_SUBJECTS, shortTaken, suggestSubjectShort, type Subject } from '@sathiya/core';
import type { SubjectInput } from './api';

const key = (name: string) => name.trim().toLowerCase();

export function standardList(platform: SubjectInput[] | undefined): readonly SubjectInput[] {
  return platform && platform.length > 0 ? platform : STANDARD_SUBJECTS;
}

export function missingDefaults(existing: Pick<Subject, 'nameEn' | 'short'>[] | Pick<Subject, 'nameEn'>[], defaults: readonly SubjectInput[]): SubjectInput[] {
  const seen = new Set(existing.map((s) => key(s.nameEn)));
  const shorts = existing.flatMap((s) => ('short' in s ? [s.short] : []));
  const out: SubjectInput[] = [];
  for (const d of defaults) {
    const k = key(d.nameEn);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const short = shortTaken(d.short, shorts) ? suggestSubjectShort(d.nameEn, shorts) : d.short;
    shorts.push(short);
    out.push(short === d.short ? d : { ...d, short });
  }
  return out;
}
