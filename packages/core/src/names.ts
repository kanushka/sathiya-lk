// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Bilingual, Lang } from './types';

export function pickName(x: Bilingual, lang: Lang): string {
  if (lang === 'si' && x.nameSi && x.nameSi.trim() !== '') return x.nameSi;
  return x.nameEn;
}
