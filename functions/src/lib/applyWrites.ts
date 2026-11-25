// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DocumentReference, WriteBatch } from 'firebase-admin/firestore';
import { db } from './admin';

export const BATCH_LIMIT = 450;

export class PartialWrite extends Error {
  constructor(
    readonly written: number,
    readonly deleted: number,
    readonly cause: unknown,
  ) {
    super('Partial write');
  }
}

export async function writeInChunks(
  deletes: DocumentReference[],
  creates: Array<{ ref: DocumentReference; data: object }>,
  newBatch: () => WriteBatch = () => db.batch(),
): Promise<{ written: number; deleted: number }> {
  let written = 0;
  let deleted = 0;
  try {
    for (let i = 0; i < deletes.length; i += BATCH_LIMIT) {
      const batch = newBatch();
      const part = deletes.slice(i, i + BATCH_LIMIT);
      part.forEach((r) => batch.delete(r));
      await batch.commit();
      deleted += part.length;
    }
    for (let i = 0; i < creates.length; i += BATCH_LIMIT) {
      const batch = newBatch();
      const part = creates.slice(i, i + BATCH_LIMIT);
      part.forEach((c) => batch.set(c.ref, c.data));
      await batch.commit();
      written += part.length;
    }
  } catch (e) {
    throw new PartialWrite(written, deleted, e);
  }
  return { written, deleted };
}
