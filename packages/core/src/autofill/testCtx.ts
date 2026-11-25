// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { C, ctx as fixtureCtx, G, S } from '../fixtures';
import type { SchoolContext, Teacher } from '../types';

const senior: Teacher = { id: 't-senior', staffId: 'SCC900', name: 'Senior', isPrimary: false, subjectIds: [S.sinhala, S.history, S.geography, S.english], grades: [12], maxPerDay: 7 };
const g6Source = fixtureCtx.grades.find((g) => g.id === G.g6)!.plan;

export const readyCtx: SchoolContext = {
  ...fixtureCtx,
  school: { ...fixtureCtx.school, grades: [1, 6, 12] },
  teachers: [...fixtureCtx.teachers, senior],
  classes: fixtureCtx.classes.map((c) =>
    c.id === C.c6c ? { ...c, planOverride: g6Source.map((i) => (i.kind === 'subject' && i.subjectId === S.pts ? { ...i, perWeek: 1 } : i)) } : c,
  ),
};
