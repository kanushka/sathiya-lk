// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { findConflicts, paths, withTeacherIds, type Entry, type SaveEntryRes } from '@sathiya/core';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, fail, invalid, obj, requireSchoolAdmin } from './lib/guards';
import { parseDraft, validateDraft } from './lib/entryDraft';
import { loadContext } from './lib/loadContext';
import { slotLock } from './lib/slotLocks';
import { runTx } from './lib/tx';

// Firestore caps array-contains-any at 30 values.
const chunks = <T>(xs: T[], n = 30): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

const lockKeys = (e: Pick<Entry, 'day' | 'classIds' | 'teacherIds'>): string[] => [
  ...e.teacherIds.map((t) => `${e.day}_t_${t}`),
  ...e.classIds.map((c) => `${e.day}_c_${c}`),
];

export const saveEntry = onCall(callOpts, async (req): Promise<SaveEntryRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const yid = docId(data.yearId, 'yearId');
  const draft = withTeacherIds(parseDraft(data.entry));

  const ctx = await loadContext(sid);
  validateDraft(ctx, draft);

  const yearRef = db.doc(`${paths.years(sid)}/${yid}`);
  const entries = db.collection(paths.entries(sid, yid));
  const ref = draft.id !== undefined ? entries.doc(draft.id) : entries.doc();

  await runTx(async (tx) => {
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
