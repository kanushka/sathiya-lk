// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
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

export const syncDirectory = onDocumentWritten({ document: 'schools/{sid}', region: REGION }, (event) => syncSchoolDirectory(event.params.sid));
