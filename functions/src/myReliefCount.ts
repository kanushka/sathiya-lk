// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type MyReliefCountRes, type ReliefStats } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { obj, requireLinkedTeacher } from './lib/guards';

// reliefMeta/stats holds every teacher's count, so teachers cannot read it; this returns only the caller's own.
// One document read: saveReliefDay keeps the counts current for the active year.
export const myReliefCount = onCall(callOpts, async (req): Promise<MyReliefCountRes> => {
  const data = obj(req.data, 'request');
  const { sid, tid, school } = await requireLinkedTeacher(req, data.schoolId);
  const yid = school.activeYearId;
  if (!yid) return { count: 0 };
  const stats = (await db.doc(paths.reliefStats(sid, yid)).get()).data() as ReliefStats | undefined;
  return { count: stats?.counts[tid] ?? 0 };
});
