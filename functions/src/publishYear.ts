// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { buildSnapshots, paths, type PublishYearRes, type Year } from '@sathiya/core';
import type { DocumentReference } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { invalid, obj, requireSchoolAdmin, str } from './lib/guards';
import { loadContext, loadEntries } from './lib/loadContext';

const BATCH_OPS = 450;

type Op = { ref: DocumentReference; data?: object };

async function commitAll(ops: Op[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_OPS) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_OPS)) (op.data ? batch.set(op.ref, op.data) : batch.delete(op.ref));
    await batch.commit();
  }
}

export const publishYear = onCall(callOpts, async (req): Promise<PublishYearRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const yid = str(data.yearId, 'yearId');
  const yearRef = db.doc(`${paths.years(sid)}/${yid}`);
  const yearSnap = await yearRef.get();
  if (!yearSnap.exists) invalid('Unknown year');
  const year = { ...(yearSnap.data() as Omit<Year, 'id'>), id: yid };

  const [ctx, entries, oldClasses, oldTeachers] = await Promise.all([
    loadContext(sid),
    loadEntries(sid, yid),
    db.collection(paths.publishedClasses(sid, yid)).listDocuments(),
    db.collection(paths.publishedTeachers(sid, yid)).listDocuments(),
  ]);
  const snaps = buildSnapshots(ctx, entries, year);

  const ops: Op[] = [
    ...snaps.classes.map((c) => ({ ref: db.doc(paths.publishedClass(sid, yid, c.classId)), data: c })),
    ...snaps.teachers.map((t) => ({ ref: db.doc(paths.publishedTeacher(sid, yid, t.teacherId)), data: t })),
  ];
  const keep = new Set(ops.map((o) => o.ref.path));
  for (const ref of [...oldClasses, ...oldTeachers]) if (!keep.has(ref.path)) ops.push({ ref });
  await commitAll(ops);

  const batch = db.batch();
  batch.update(yearRef, { status: 'published', publishedAt: Date.now() });
  batch.update(db.doc(paths.school(sid)), { activeYearId: yid });
  await batch.commit();
  return { classes: snaps.classes.length, teachers: snaps.teachers.length };
});
