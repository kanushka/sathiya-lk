// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName } from './names';
import type { Lang, School, SchoolDirectoryEntry } from './types';

export function directoryEntry(school: Pick<School, 'nameEn' | 'nameSi' | 'district' | 'city' | 'status'>): SchoolDirectoryEntry {
  const { nameEn, nameSi, district, city, status } = school;
  return { nameEn, ...(nameSi === undefined ? {} : { nameSi }), district, city, status };
}

export function directoryLabel(entry: SchoolDirectoryEntry, lang: Lang): string {
  const name = pickName(entry, lang);
  const city = entry.city.trim();
  return city ? `${name}, ${city}` : name;
}
