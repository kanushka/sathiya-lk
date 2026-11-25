// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { similarSchools, type ReviewSchoolReq, type School } from '@sathiya/core';
import { call } from '../../lib/callable';

export type ReviewFn = (req: ReviewSchoolReq) => Promise<unknown>;

export const defaultReview: ReviewFn = (req) => call('reviewSchool', req);

export const REASON_MAX = 500;
const AREA_LIMIT = 8;

export interface Duplicates {
  similar: School[];
  sameArea: School[];
}

const norm = (v: string | undefined) => (v ?? '').trim().toLowerCase();

export function possibleDuplicates(school: School, all: School[]): Duplicates {
  const others = all.filter((s) => s.id !== school.id);
  const byId = new Map(others.map((s) => [s.id, s]));
  const candidates = others.flatMap((s) => [s.nameEn, s.nameSi].filter((n): n is string => !!n?.trim()).map((name) => ({ id: s.id, name })));
  const ids = new Set<string>();
  for (const name of [school.nameEn, school.nameSi]) {
    if (!name?.trim()) continue;
    for (const m of similarSchools(name, candidates, 10)) ids.add(m.id);
  }
  const similar = [...ids].slice(0, 5).map((id) => byId.get(id)!);
  const city = norm(school.city);
  const sameArea = others
    .filter((s) => s.district === school.district && !ids.has(s.id))
    .sort((a, b) => Number(norm(b.city) === city) - Number(norm(a.city) === city) || a.nameEn.localeCompare(b.nameEn))
    .slice(0, AREA_LIMIT);
  return { similar, sameArea };
}
