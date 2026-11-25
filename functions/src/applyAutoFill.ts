// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { APPLY_AUTOFILL_MAX_ITEMS as MAX_ITEMS, findConflicts, paths, withTeacherIds, type ApplyAutoFillRes, type Conflict, type Entry, type EntryDraft } from '@sathiya/core';
import { logger } from 'firebase-functions/logger';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { PartialWrite, writeInChunks } from './lib/applyWrites';
import { callOpts } from './lib/callOptions';
import { parseDraft, validateDraft } from './lib/entryDraft';
import { docId, docIdList, fail, invalid, obj, requireApprovedSchool } from './lib/guards';
import { loadContext, loadEntries } from './lib/loadContext';
import { acquireLease, APPLY_TIMEOUT_S, releaseLease } from './lib/yearBusy';

export const applyAutoFill = onCall({ ...callOpts, timeoutSeconds: APPLY_TIMEOUT_S }, async (req): Promise<ApplyAutoFillRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireApprovedSchool(req, data.schoolId);
  const yid = docId(data.yearId, 'yearId');
  if (!Array.isArray(data.drafts) || data.drafts.length > MAX_ITEMS) invalid(`drafts must be a list of up to ${MAX_ITEMS}`);
  const deleteIds = docIdList(data.deleteEntryIds, 'deleteEntryIds');
  if (deleteIds.length > MAX_ITEMS) invalid(`deleteEntryIds must be up to ${MAX_ITEMS}`);
  const drafts: Array<EntryDraft & { teacherIds: string[] }> = (data.drafts as unknown[]).map((d) => withTeacherIds(parseDraft(d)));

  const ctx = await loadContext(sid);
  drafts.forEach((d) => validateDraft(ctx, d));

  const yearRef = db.doc(`${paths.years(sid)}/${yid}`);
  const lease = await acquireLease(yearRef);

  try {
    const existing = await loadEntries(sid, yid);
    const existingIds = new Set(existing.map((e) => e.id));
    const unknown = deleteIds.find((id) => !existingIds.has(id));
    if (unknown !== undefined) fail('failed-precondition', 'clash', `Entry ${unknown} no longer exists`, { stale: true });
    const gone = new Set(deleteIds);
    const combined: Entry[] = [
      ...existing.filter((e) => !gone.has(e.id)),
      ...drafts.map((d, i) => ({ ...d, id: `draft-${i}` })),
    ];

    const conflicts: Array<Conflict & { draftIndex: number }> = [];
    drafts.forEach((d, i) => {
      for (const c of findConflicts({ ...d, id: `draft-${i}` }, combined, ctx)) {
        const other = /^draft-(\d+)$/.exec(c.entryId);
        if (other && Number(other[1]) < i) continue;
        conflicts.push({ draftIndex: i, ...c });
      }
    });
    if (conflicts.length) fail('failed-precondition', 'clash', 'The auto-fill clashes with the timetable', { conflicts });

    const entries = db.collection(paths.entries(sid, yid));
    try {
      return await writeInChunks(
        deleteIds.map((id) => entries.doc(id)),
        drafts.map(({ id: _id, ...doc }) => ({ ref: entries.doc(), data: doc })),
      );
    } catch (e) {
      if (!(e instanceof PartialWrite)) throw e;
      logger.error('applyAutoFill failed part-way', { written: e.written, deleted: e.deleted, error: e.cause });
      throw new HttpsError('internal', 'Saving the auto-fill failed part-way', { written: e.written, deleted: e.deleted });
    }
  } finally {
    await releaseLease(yearRef, lease).catch((e) => logger.error('applyAutoFill could not release the lease', e));
  }
});
