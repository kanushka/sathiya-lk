// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  colomboToday,
  LEAVE_TYPES,
  paths,
  validateRelief,
  type Leave,
  type LeaveType,
  type ReliefDay,
  type ReliefNotified,
  type SaveReliefDayRes,
} from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, docIdList, fail, invalid, obj, requireSchoolAdmin, str } from './lib/guards';
import { loadContext, loadTeacherSnapshots } from './lib/loadContext';
import { runTx } from './lib/tx';
import { countsOf, dayRefs, emailable, mailCandidates, readDay, rebuildDay, writeDay, type Picks } from './relief/day';
import { queueReliefMails } from './relief/mailQueue';

const MAX_LEAVES = 50;
const MAX_RELIEFS = 300;

function parseLeaves(v: unknown): Leave[] {
  if (!Array.isArray(v) || v.length > MAX_LEAVES) invalid(`leaves must be a list of at most ${MAX_LEAVES}`);
  const leaves = (v as unknown[]).map((x): Leave => {
    const l = obj(x, 'leave');
    if (!LEAVE_TYPES.includes(l.type as LeaveType)) invalid('leave type is not valid');
    return { teacherId: docId(l.teacherId, 'teacherId'), type: l.type as LeaveType, entryIds: docIdList(l.entryIds, 'entryIds') };
  });
  if (new Set(leaves.map((l) => l.teacherId)).size !== leaves.length) invalid('A teacher can be on leave only once');
  return leaves;
}

// Only the pick is read from the client; every other field is rebuilt from the published timetable.
function parsePicks(v: unknown): Picks {
  if (!Array.isArray(v) || v.length > MAX_RELIEFS) invalid(`reliefs must be a list of at most ${MAX_RELIEFS}`);
  const picks: Picks = new Map();
  const seen = new Set<string>();
  for (const x of v as unknown[]) {
    const r = obj(x, 'relief');
    const entryId = docId(r.entryId, 'entryId');
    const absent = docId(r.absentTeacherId, 'absentTeacherId');
    const key = JSON.stringify([entryId, absent]);
    if (seen.has(key)) invalid('A lesson can have only one relief');
    seen.add(key);
    const pick = r.reliefTeacherId === null ? null : docId(r.reliefTeacherId, 'reliefTeacherId');
    picks.set(`${entryId}|${absent}`, pick);
  }
  return picks;
}

export const saveReliefDay = onCall(callOpts, async (req): Promise<SaveReliefDayRes> => {
  const data = obj(req.data, 'request');
  const { sid, school, uid } = await requireSchoolAdmin(req, data.schoolId);
  const yid = docId(data.yearId, 'yearId');
  const date = str(data.date, 'date', 10);
  const today = colomboToday(new Date());
  if (date !== today.date || today.day === null) fail('invalid-argument', 'not-today', "Only today's relief can be edited");
  const day = today.day!;
  const asked = parseLeaves(data.leaves);
  const picks = parsePicks(data.reliefs);
  const expectedUpdatedAt = data.expectedUpdatedAt === null ? null : typeof data.expectedUpdatedAt === 'number' && Number.isFinite(data.expectedUpdatedAt) ? data.expectedUpdatedAt : invalid('expectedUpdatedAt is not valid');

  const yearSnap = await db.doc(`${paths.years(sid)}/${yid}`).get();
  if (yid !== school.activeYearId || !yearSnap.exists || (yearSnap.data() as { status?: string }).status !== 'published') invalid('Publish a timetable first');

  const [ctx, snaps] = await Promise.all([loadContext(sid), loadTeacherSnapshots(sid, yid)]);
  if ([...snaps.values()].some((s) => s.cells.some((c) => c.entryId === undefined))) {
    fail('failed-precondition', 'republish', 'Republish the timetable to enable relief');
  }
  const gradeNo = new Map(ctx.grades.map((g) => [g.id, g.number]));
  const gradeOfClass = new Map(ctx.classes.flatMap((c) => (gradeNo.has(c.gradeId) ? [[c.id, gradeNo.get(c.gradeId)!] as const] : [])));
  const { leaves, reliefs } = rebuildDay(asked, picks, snaps, day);

  const refs = dayRefs(sid, yid, date);
  const [oldSnap, notifiedSnap] = await Promise.all([refs.day.get(), refs.notified.get()]);
  const hasEmail = await emailable(sid, ctx, mailCandidates(oldSnap.data() as ReliefDay | undefined, reliefs, notifiedSnap.data() as Partial<ReliefNotified> | undefined));

  const { updatedAt, changed } = await runTx(async (tx) => {
    const read = await readDay(tx, sid, yid, date);
    if ((read.old?.updatedAt ?? null) !== expectedUpdatedAt) fail('failed-precondition', 'stale', "Someone else changed today's relief; reload");

    const counts: Record<string, number> = { ...read.stats };
    for (const [t, n] of Object.entries(countsOf(read.old?.reliefs ?? []))) counts[t] = Math.max(0, (counts[t] ?? 0) - n);
    const errors = validateRelief({ leaves, reliefs }, { teachers: ctx.teachers, snaps, gradeOfClass, day, leaves, counts });
    if (errors.length) fail('failed-precondition', 'invalid-relief', 'Relief has problems', { errors });

    const { savedAt, changed } = writeDay(tx, { sid, yid, date, day, uid, ctx, leaves, reliefs, hasEmail }, read);
    return { updatedAt: savedAt, changed };
  });

  const queued = await queueReliefMails({ sid, yid, date, savedAt: updatedAt }, changed.filter((t) => hasEmail.has(t)));

  return { updatedAt, queued, skippedNoEmail: changed.length - queued, uncovered: reliefs.filter((r) => r.reliefTeacherId === null).length };
});
