// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  colomboToday,
  paths,
  reliefKey,
  reliefSlots,
  teacherDisplayName,
  type DayIndex,
  type Leave,
  type Relief,
  type ReliefDay,
  type ReliefLabel,
  type ReliefNotified,
  type ReliefStats,
  type SchoolContext,
  type Teacher,
  type TeacherSnapshot,
} from '@sathiya/core';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { db } from '../lib/admin';
import { runTx } from '../lib/tx';
import { queueReliefMails } from './mailQueue';

export type Picks = Map<string, string | null>;
type Notified = Partial<ReliefNotified> | undefined;

export const pickKey = (r: Pick<Relief, 'entryId' | 'absentTeacherId'>): string => `${r.entryId}|${r.absentTeacherId}`;

export const dayRefs = (sid: string, yid: string, date: string) => ({
  day: db.doc(paths.reliefDay(sid, yid, date)),
  stats: db.doc(paths.reliefStats(sid, yid)),
  notified: db.doc(paths.reliefNotified(sid, yid, date)),
});

export function countsOf(reliefs: Relief[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reliefs) if (r.reliefTeacherId !== null) out[r.reliefTeacherId] = (out[r.reliefTeacherId] ?? 0) + 1;
  return out;
}

const relievers = (reliefs: Relief[]): string[] => reliefs.flatMap((r) => (r.reliefTeacherId === null ? [] : [r.reliefTeacherId]));

// A republish can remove a ticked lesson; drop it, and rebuild every relief from the published timetable.
export function rebuildDay(asked: Leave[], picks: Picks, snaps: Map<string, TeacherSnapshot>, day: DayIndex): { leaves: Leave[]; reliefs: Relief[] } {
  const leaves = asked.map((l): Leave => {
    const lessons = new Set((snaps.get(l.teacherId)?.cells ?? []).flatMap((c) => (c.day === day && c.entryId !== undefined ? [c.entryId] : [])));
    return { ...l, entryIds: l.entryIds.filter((id) => lessons.has(id)) };
  });
  const reliefs = reliefSlots(leaves, snaps, day).map((s) => ({ ...s, reliefTeacherId: picks.get(pickKey(s)) ?? null }));
  return { leaves, reliefs };
}

export function mailCandidates(old: ReliefDay | undefined, reliefs: Relief[], notified: Notified): Set<string> {
  return new Set([...relievers(reliefs), ...relievers(old?.reliefs ?? []), ...Object.keys(notified?.sent ?? {})]);
}

export async function emailable(sid: string, ctx: SchoolContext, ids: Iterable<string>): Promise<Set<string>> {
  const teacherById = new Map(ctx.teachers.map((t) => [t.id, t]));
  const out = new Set<string>();
  for (const id of ids) {
    const t = teacherById.get(id);
    let to = t?.email?.trim();
    if (!to && t?.uid) {
      try {
        to = ((await db.doc(`${paths.members(sid)}/${t.uid}`).get()).data() as { email?: string } | undefined)?.email?.trim();
      } catch (e) {
        logger.error('relief mail address lookup failed', e);
      }
    }
    if (to) out.add(id);
  }
  return out;
}

function nameOf(t: Teacher): { en: string; si?: string } {
  const en = teacherDisplayName(t, 'en');
  const si = teacherDisplayName(t, 'si');
  return si === en ? { en } : { en, si };
}

function describe(ctx: SchoolContext, leaves: Leave[], reliefs: Relief[]): Pick<ReliefDay, 'names' | 'labels'> {
  const teacherById = new Map(ctx.teachers.map((t) => [t.id, t]));
  const names: ReliefDay['names'] = {};
  for (const id of new Set([...leaves.map((l) => l.teacherId), ...relievers(reliefs)])) {
    const t = teacherById.get(id);
    if (t) names[id] = nameOf(t);
  }
  const labels: Record<string, ReliefLabel> = {};
  for (const r of reliefs) {
    const subject = ctx.subjects.find((s) => s.id === r.subjectId);
    const subSi = subject?.nameSi?.trim();
    labels[pickKey(r)] = {
      cls: r.classIds.map((id) => ctx.classes.find((c) => c.id === id)?.name ?? id).join('+'),
      sub: subject?.short || subject?.nameEn || '',
      ...(subSi ? { subSi } : {}),
    };
  }
  return { names, labels };
}

// Teachers to notify: those whose duties changed in this write, and those whose last mail no longer matches with
// nothing queued, so a re-save retries a mail that was never queued without resending one already delivered.
function toNotify(old: ReliefDay | undefined, reliefs: Relief[], notified: Notified, hasEmail: Set<string>): string[] {
  const sent = notified?.sent ?? {};
  const pending = notified?.pending ?? {};
  return [...mailCandidates(old, reliefs, notified)].filter((t) => {
    const now = reliefKey(reliefs, t);
    if (reliefKey(old?.reliefs ?? [], t) !== now) return true;
    return hasEmail.has(t) && pending[t] === undefined && now !== (sent[t]?.key ?? '');
  });
}

export interface DayWrite {
  sid: string;
  yid: string;
  date: string;
  day: DayIndex;
  uid: string;
  ctx: SchoolContext;
  leaves: Leave[];
  reliefs: Relief[];
  hasEmail: Set<string>;
}

export interface DayRead {
  old: ReliefDay | undefined;
  stats: Record<string, number>;
  notified: Notified;
}

export function writeDay(tx: Transaction, w: DayWrite, read: DayRead): { savedAt: number; changed: string[] } {
  const refs = dayRefs(w.sid, w.yid, w.date);
  const savedAt = Date.now();
  const doc: ReliefDay = { date: w.date, day: w.day, leaves: w.leaves, reliefs: w.reliefs, ...describe(w.ctx, w.leaves, w.reliefs), updatedAt: savedAt, updatedBy: w.uid };
  tx.set(refs.day, doc);

  const merged: Record<string, number> = { ...read.stats };
  for (const [t, n] of Object.entries(countsOf(read.old?.reliefs ?? []))) merged[t] = (merged[t] ?? 0) - n;
  for (const [t, n] of Object.entries(countsOf(w.reliefs))) merged[t] = (merged[t] ?? 0) + n;
  for (const t of Object.keys(merged)) if (merged[t]! <= 0) delete merged[t];
  tx.set(refs.stats, { counts: merged } satisfies ReliefStats);

  const changed = toNotify(read.old, w.reliefs, read.notified, w.hasEmail);
  if (changed.length) {
    const pending = Object.fromEntries(changed.map((t) => [t, w.hasEmail.has(t) ? savedAt : FieldValue.delete()]));
    tx.set(refs.notified, { pending }, { merge: true });
  }
  return { savedAt, changed };
}

export async function readDay(tx: Transaction, sid: string, yid: string, date: string): Promise<DayRead> {
  const refs = dayRefs(sid, yid, date);
  const [d, s, n] = await Promise.all([tx.get(refs.day), tx.get(refs.stats), tx.get(refs.notified)]);
  return { old: d.data() as ReliefDay | undefined, stats: (s.data() as ReliefStats | undefined)?.counts ?? {}, notified: n.data() as Notified };
}

const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

// Brings today's relief in line with a republished timetable, as the next save would, so teachers never see a stale duty.
export async function refreshTodayRelief(sid: string, yid: string, uid: string, ctx: SchoolContext, snaps: Map<string, TeacherSnapshot>): Promise<void> {
  const today = colomboToday(new Date());
  if (today.day === null) return;
  const day = today.day;
  const refs = dayRefs(sid, yid, today.date);
  const [daySnap, notifiedSnap] = await Promise.all([refs.day.get(), refs.notified.get()]);
  const first = daySnap.data() as ReliefDay | undefined;
  if (!first) return;
  const firstNext = rebuildDay(first.leaves, new Map(first.reliefs.map((r) => [pickKey(r), r.reliefTeacherId])), snaps, day);
  const hasEmail = await emailable(sid, ctx, mailCandidates(first, firstNext.reliefs, notifiedSnap.data() as Notified));

  const result = await runTx(async (tx) => {
    const read = await readDay(tx, sid, yid, today.date);
    const { old } = read;
    if (!old) return null;
    const { leaves, reliefs } = rebuildDay(old.leaves, new Map(old.reliefs.map((r) => [pickKey(r), r.reliefTeacherId])), snaps, day);
    const same = canon({ leaves, reliefs, ...describe(ctx, leaves, reliefs) }) === canon({ leaves: old.leaves, reliefs: old.reliefs, names: old.names, labels: old.labels ?? {} });
    if (same) return null;
    return writeDay(tx, { sid, yid, date: today.date, day, uid, ctx, leaves, reliefs, hasEmail }, read);
  });
  if (result) await queueReliefMails({ sid, yid, date: today.date, savedAt: result.savedAt }, result.changed.filter((t) => hasEmail.has(t)));
}
