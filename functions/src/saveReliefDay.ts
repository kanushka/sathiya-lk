// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  colomboToday,
  LEAVE_TYPES,
  paths,
  reliefSlots,
  teacherDisplayName,
  validateRelief,
  type Leave,
  type LeaveType,
  type Relief,
  type ReliefDay,
  type ReliefStats,
  type SaveReliefDayRes,
  type Teacher,
} from '@sathiya/core';
import { logger } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, docIdList, fail, invalid, obj, requireSchoolAdmin, str } from './lib/guards';
import { loadContext, loadTeacherSnapshots } from './lib/loadContext';
import { runTx } from './lib/tx';
import { enqueueReliefMail } from './relief/mailQueue';

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
function parsePicks(v: unknown): Map<string, string | null> {
  if (!Array.isArray(v) || v.length > MAX_RELIEFS) invalid(`reliefs must be a list of at most ${MAX_RELIEFS}`);
  const picks = new Map<string, string | null>();
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

const countsOf = (reliefs: Relief[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const r of reliefs) if (r.reliefTeacherId !== null) out[r.reliefTeacherId] = (out[r.reliefTeacherId] ?? 0) + 1;
  return out;
};

const entrySets = (reliefs: Relief[]): Map<string, string> => {
  const by = new Map<string, string[]>();
  for (const r of reliefs) if (r.reliefTeacherId !== null) by.set(r.reliefTeacherId, [...(by.get(r.reliefTeacherId) ?? []), r.entryId]);
  return new Map([...by].map(([t, ids]) => [t, ids.sort().join('|')]));
};

function nameOf(t: Teacher): { en: string; si?: string } {
  const en = teacherDisplayName(t, 'en');
  const si = teacherDisplayName(t, 'si');
  return si === en ? { en } : { en, si };
}

export const saveReliefDay = onCall(callOpts, async (req): Promise<SaveReliefDayRes> => {
  const data = obj(req.data, 'request');
  const { sid, school, uid } = await requireSchoolAdmin(req, data.schoolId);
  const yid = docId(data.yearId, 'yearId');
  const date = str(data.date, 'date', 10);
  const today = colomboToday(new Date());
  if (date !== today.date || today.day === null) invalid("Only today's relief can be edited");
  const day = today.day!;
  const leaves = parseLeaves(data.leaves);
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
  const reliefs: Relief[] = reliefSlots(leaves, snaps, day).map((s) => ({ ...s, reliefTeacherId: picks.get(`${s.entryId}|${s.absentTeacherId}`) ?? null }));

  const dayRef = db.doc(paths.reliefDay(sid, yid, date));
  const statsRef = db.doc(paths.reliefStats(sid, yid));
  const teacherById = new Map(ctx.teachers.map((t) => [t.id, t]));

  const { updatedAt, changed } = await runTx(async (tx) => {
    const [daySnap, statsSnap] = await Promise.all([tx.get(dayRef), tx.get(statsRef)]);
    const old = daySnap.data() as ReliefDay | undefined;
    if ((old?.updatedAt ?? null) !== expectedUpdatedAt) fail('failed-precondition', 'stale', "Someone else changed today's relief; reload");

    const oldCounts = countsOf(old?.reliefs ?? []);
    const stats = (statsSnap.data() as ReliefStats | undefined)?.counts ?? {};
    const counts: Record<string, number> = { ...stats };
    for (const [t, n] of Object.entries(oldCounts)) counts[t] = Math.max(0, (counts[t] ?? 0) - n);

    const errors = validateRelief({ leaves, reliefs }, { teachers: ctx.teachers, snaps, gradeOfClass, day, leaves, counts });
    if (errors.length) fail('failed-precondition', 'invalid-relief', 'Relief has problems', { errors });

    const ids = new Set([...leaves.map((l) => l.teacherId), ...reliefs.flatMap((r) => (r.reliefTeacherId === null ? [] : [r.reliefTeacherId]))]);
    const names: ReliefDay['names'] = {};
    for (const id of ids) {
      const t = teacherById.get(id);
      if (t) names[id] = nameOf(t);
    }
    const savedAt = Date.now();
    const doc: ReliefDay = { date, day, leaves, reliefs, names, updatedAt: savedAt, updatedBy: uid };
    tx.set(dayRef, doc);

    const next = countsOf(reliefs);
    const merged: Record<string, number> = { ...stats };
    for (const [t, n] of Object.entries(oldCounts)) merged[t] = (merged[t] ?? 0) - n;
    for (const [t, n] of Object.entries(next)) merged[t] = (merged[t] ?? 0) + n;
    for (const t of Object.keys(merged)) if (merged[t]! <= 0) delete merged[t];
    tx.set(statsRef, { counts: merged } satisfies ReliefStats);

    const before = entrySets(old?.reliefs ?? []);
    const after = entrySets(reliefs);
    const changedIds = [...new Set([...before.keys(), ...after.keys()])].filter((t) => before.get(t) !== after.get(t));
    if (changedIds.length) {
      tx.set(db.doc(paths.reliefNotified(sid, yid, date)), { pending: Object.fromEntries(changedIds.map((t) => [t, savedAt])) }, { merge: true });
    }
    return { updatedAt: savedAt, changed: changedIds };
  });

  const members = paths.members(sid);
  const withEmail: string[] = [];
  let skippedNoEmail = 0;
  for (const id of changed) {
    const t = teacherById.get(id);
    let to = t?.email?.trim();
    if (!to && t?.uid) {
      try {
        to = ((await db.doc(`${members}/${t.uid}`).get()).data() as { email?: string } | undefined)?.email?.trim();
      } catch (e) {
        logger.error('relief mail address lookup failed', e);
      }
    }
    if (to) withEmail.push(id);
    else skippedNoEmail++;
  }
  await Promise.all(withEmail.map((teacherId) => enqueueReliefMail({ sid, yid, date, teacherId, savedAt: updatedAt })));

  return { updatedAt, queued: withEmail.length, skippedNoEmail, uncovered: reliefs.filter((r) => r.reliefTeacherId === null).length };
});
