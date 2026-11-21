import type { Subject } from '@sathiya/core';
import type { SubjectInput } from './api';

const key = (name: string) => name.trim().toLowerCase();

export function missingDefaults(existing: Pick<Subject, 'nameEn'>[], defaults: SubjectInput[]): SubjectInput[] {
  const seen = new Set(existing.map((s) => key(s.nameEn)));
  const out: SubjectInput[] = [];
  for (const d of defaults) {
    const k = key(d.nameEn);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}
