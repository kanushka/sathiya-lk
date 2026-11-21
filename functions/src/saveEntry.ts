// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { findConflicts, paths, windowOf, withTeacherIds, type DayIndex, type Entry, type EntryDraft, type Lesson, type SaveEntryRes } from '@sathiya/core';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { fail, int, invalid, obj, optStr, requireSchoolAdmin, str, strList } from './lib/guards';
import { loadContext } from './lib/loadContext';
import { slotLock } from './lib/slotLocks';

// Firestore caps array-contains-any at 30 values.
const chunks = <T>(xs: T[], n = 30): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

function parseDraft(v: unknown): EntryDraft {
  const e = obj(v, 'entry');
  const classIds = strList(e.classIds, 'classIds');
  if (!classIds.length) invalid('entry needs at least one class');
  if (!Array.isArray(e.lessons) || !e.lessons.length || e.lessons.length > 30) invalid('entry needs 1–30 lessons');
  const lessons: Lesson[] = (e.lessons as unknown[]).map((l) => {
    const x = obj(l, 'lesson');
    return { subjectId: str(x.subjectId, 'subjectId'), teacherId: x.teacherId === null ? null : str(x.teacherId, 'teacherId') };
  });
  const draft: EntryDraft = { day: int(e.day, 'day', 0, 4) as DayIndex, period: int(e.period, 'period', 1, 30), classIds, lessons };
  const id = optStr(e.id, 'id');
  const groupKey = optStr(e.groupKey, 'groupKey');
  if (id !== undefined) draft.id = id;
  if (groupKey !== undefined) draft.groupKey = groupKey;
  return draft;
}

const lockKeys = (e: Pick<Entry, 'day' | 'classIds' | 'teacherIds'>): string[] => [
  ...e.teacherIds.map((t) => `${e.day}_t_${t}`),
  ...e.classIds.map((c) => `${e.day}_c_${c}`),
];

export const saveEntry = onCall(callOpts, async (req): Promise<SaveEntryRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const yid = str(data.yearId, 'yearId');
  const draft = withTeacherIds(parseDraft(data.entry));

  const ctx = await loadContext(sid);
  const classes = draft.classIds.map((id) => ctx.classes.find((c) => c.id === id) ?? invalid(`Unknown class ${id}`));
  const first = classes[0]!;
  if (classes.some((c) => c.gradeId !== first.gradeId)) invalid('All classes in a block must be in the same grade');
  if (classes.some((c) => c.templateId !== first.templateId)) invalid('All classes in a block must use the same period template');
  const template = ctx.templates.find((t) => t.id === first.templateId) ?? invalid(`Class ${first.name} has no period template`);
  if (!windowOf(template, draft.day, draft.period)) invalid(`Period ${draft.period} does not exist on that day for ${first.name}`);
  for (const l of draft.lessons) {
    if (!ctx.subjects.some((s) => s.id === l.subjectId)) invalid(`Unknown subject ${l.subjectId}`);
    if (l.teacherId !== null && !ctx.teachers.some((t) => t.id === l.teacherId)) invalid(`Unknown teacher ${l.teacherId}`);
  }

  const yearRef = db.doc(`${paths.years(sid)}/${yid}`);
  const entries = db.collection(paths.entries(sid, yid));
  const ref = draft.id !== undefined ? entries.doc(draft.id) : entries.doc();

  await db.runTransaction(async (tx) => {
    if (!(await tx.get(yearRef)).exists) invalid('Unknown year');
    const keys = new Set(lockKeys(draft));
    if (draft.id !== undefined) {
      const old = await tx.get(ref);
      if (!old.exists) fail('not-found', 'invalid', 'Entry not found');
      lockKeys(old.data() as Entry).forEach((k) => keys.add(k));
    }
    // Every clash shares a (day, teacher) or (day, class) with the draft, so these lock docs serialise competing saves.
    const locks: DocumentReference[] = [...keys].sort().map((k) => db.doc(slotLock(sid, yid, k)));
    await tx.getAll(...locks);

    const found = new Map<string, Entry>();
    const sameDay = entries.where('day', '==', draft.day);
    const queries = [
      ...chunks(draft.teacherIds).map((ids) => sameDay.where('teacherIds', 'array-contains-any', ids)),
      ...chunks(draft.classIds).map((ids) => sameDay.where('classIds', 'array-contains-any', ids)),
    ];
    for (const q of queries) for (const d of (await tx.get(q)).docs) found.set(d.id, { ...(d.data() as Entry), id: d.id });

    const conflicts = findConflicts(draft, [...found.values()], ctx);
    if (conflicts.length) fail('failed-precondition', 'clash', 'The entry clashes with the timetable', { conflicts });

    for (const lock of locks) tx.set(lock, { updatedAt: FieldValue.serverTimestamp(), entryId: ref.id });
    const { id: _id, ...doc } = draft;
    tx.set(ref, doc);
  });
  return { entryId: ref.id };
});
