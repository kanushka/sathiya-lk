// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { findConflicts, paths, withTeacherIds, type ApplyAutoFillRes, type Conflict, type Entry, type EntryDraft } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { parseDraft, validateDraft } from './lib/entryDraft';
import { docId, docIdList, fail, invalid, obj, requireSchoolAdmin } from './lib/guards';
import { loadContext, loadEntries } from './lib/loadContext';
import { runTx } from './lib/tx';
import { APPLY_LEASE_MS, assertNotApplying } from './lib/yearBusy';

const BATCH_LIMIT = 450;
const MAX_ITEMS = 3000;

export const applyAutoFill = onCall({ ...callOpts, timeoutSeconds: 300 }, async (req): Promise<ApplyAutoFillRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const yid = docId(data.yearId, 'yearId');
  if (!Array.isArray(data.drafts) || data.drafts.length > MAX_ITEMS) invalid(`drafts must be a list of up to ${MAX_ITEMS}`);
  const deleteIds = docIdList(data.deleteEntryIds, 'deleteEntryIds');
  if (deleteIds.length > MAX_ITEMS) invalid(`deleteEntryIds must be up to ${MAX_ITEMS}`);
  const drafts: Array<EntryDraft & { teacherIds: string[] }> = (data.drafts as unknown[]).map((d) => withTeacherIds(parseDraft(d)));

  const ctx = await loadContext(sid);
  drafts.forEach((d) => validateDraft(ctx, d));

  const yearRef = db.doc(`${paths.years(sid)}/${yid}`);
  await runTx(async (tx) => {
    const year = await tx.get(yearRef);
    if (!year.exists) invalid('Unknown year');
    assertNotApplying(year);
    tx.update(yearRef, { applyingUntil: Date.now() + APPLY_LEASE_MS });
  });

  let written = 0;
  let deleted = 0;
  try {
    const existing = await loadEntries(sid, yid);
    const existingIds = new Set(existing.map((e) => e.id));
    const unknown = deleteIds.find((id) => !existingIds.has(id));
    if (unknown !== undefined) invalid(`Unknown entry ${unknown}`);
    const gone = new Set(deleteIds);
    const base = existing.filter((e) => !gone.has(e.id));
    const synthetic: Entry[] = drafts.map((d, i) => ({ ...d, id: `draft-${i}` }));

    const conflicts: Array<Conflict & { draftIndex: number }> = [];
    drafts.forEach((d, i) => {
      const others = [...base, ...synthetic.filter((_, j) => j !== i)];
      for (const c of findConflicts({ ...d, id: `draft-${i}` }, others, ctx)) conflicts.push({ draftIndex: i, ...c });
    });
    if (conflicts.length) fail('failed-precondition', 'clash', 'The auto-fill clashes with the timetable', { conflicts });

    const entries = db.collection(paths.entries(sid, yid));
    try {
      for (let i = 0; i < deleteIds.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        const part = deleteIds.slice(i, i + BATCH_LIMIT);
        part.forEach((id) => batch.delete(entries.doc(id)));
        await batch.commit();
        deleted += part.length;
      }
      for (let i = 0; i < drafts.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        const part = drafts.slice(i, i + BATCH_LIMIT);
        for (const d of part) {
          const { id: _id, ...doc } = d;
          batch.set(entries.doc(), doc);
        }
        await batch.commit();
        written += part.length;
      }
    } catch {
      throw new HttpsError('internal', 'Saving the auto-fill failed part-way', { written, deleted });
    }
    return { written, deleted };
  } finally {
    await yearRef.update({ applyingUntil: FieldValue.delete() }).catch(() => undefined);
  }
});
