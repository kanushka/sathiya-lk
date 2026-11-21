// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from './lib/admin';
import { directoryFields, sameDirectory } from './lib/directory';

export const syncDirectory = onDocumentWritten('schools/{sid}', async (event) => {
  const { sid } = event.params;
  const ref = db.doc(paths.directory(sid));
  const after = event.data?.after;
  if (!after?.exists) {
    await ref.delete();
    return;
  }
  const want = directoryFields(after.data()!);
  if (sameDirectory(want, (await ref.get()).data())) return;
  await ref.set(want);
});
