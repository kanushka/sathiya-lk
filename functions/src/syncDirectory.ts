// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, sameSchoolName, snapshotSchoolName, type Bilingual } from '@sathiya/core';
import type { DocumentReference } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from './lib/admin';
import { REGION } from './lib/callOptions';
import { directoryFields, listed, sameDirectory } from './lib/directory';

// Triggers are at-least-once and unordered, so the event payload is ignored: the school doc is the source of truth.
export async function syncSchoolDirectory(sid: string): Promise<void> {
  const schoolRef = db.doc(paths.school(sid));
  const dirRef = db.doc(paths.directory(sid));
  await db.runTransaction(async (tx) => {
    const [school, dir] = await Promise.all([tx.get(schoolRef), tx.get(dirRef)]);
    if (!school.exists || !listed(school.get('status'))) {
      if (dir.exists) tx.delete(dirRef);
      return;
    }
    const want = directoryFields(school.data()!);
    if (!sameDirectory(want, dir.data())) tx.set(dirRef, want);
  });
}

const BATCH_OPS = 450;

async function publishedRefs(sid: string): Promise<DocumentReference[]> {
  const years = await db.collection(paths.years(sid)).listDocuments();
  const lists = await Promise.all(
    years.flatMap((y) => [db.collection(paths.publishedClasses(sid, y.id)).listDocuments(), db.collection(paths.publishedTeachers(sid, y.id)).listDocuments()]),
  );
  return lists.flat();
}

// Published snapshots carry the school name, so a rename reaches them without a republish.
// Each batch re-reads the school in its transaction: a run for a superseded name stops instead of overwriting a newer one.
// publishedName records the name every snapshot has; until it matches, the next write to the school retries.
export async function syncPublishedName(sid: string): Promise<void> {
  const schoolRef = db.doc(paths.school(sid));
  const school = await schoolRef.get();
  if (!school.exists) return;
  const want: Bilingual = snapshotSchoolName(school.data() as Bilingual);
  if (sameSchoolName(want, school.get('publishedName'))) return;
  const refs = await publishedRefs(sid);
  const current = async (tx: FirebaseFirestore.Transaction) => {
    const now = await tx.get(schoolRef);
    return now.exists && sameSchoolName(want, snapshotSchoolName(now.data() as Bilingual));
  };
  for (let i = 0; i < refs.length; i += BATCH_OPS) {
    const ok = await db.runTransaction(async (tx) => {
      if (!(await current(tx))) return false;
      for (const ref of refs.slice(i, i + BATCH_OPS)) tx.update(ref, { schoolName: want });
      return true;
    });
    if (!ok) return;
  }
  await db.runTransaction(async (tx) => {
    if (await current(tx)) tx.update(schoolRef, { publishedName: want });
  });
}

export const syncDirectory = onDocumentWritten({ document: 'schools/{sid}', region: REGION }, async (event) => {
  await Promise.all([syncSchoolDirectory(event.params.sid), syncPublishedName(event.params.sid)]);
});
