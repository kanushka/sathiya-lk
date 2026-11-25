// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { DAY_INDEXES, paths, remapEntries, validateTemplate, type DayIndex, type Entry, type PeriodTemplate, type SaveTemplateRes, type TemplatePatch, type TemplateRow } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, fail, invalid, obj, optDocId, optStr, requireSchoolAdmin, str } from './lib/guards';
import { latestYearId } from './lib/yearEntries';
import { runTx } from './lib/tx';
import { assertNotApplying } from './lib/yearBusy';

const BATCH_LIMIT = 450;
const MAX_ROWS = 40;
const MAX_TIME_LEN = 5;
const ROW_TYPES: readonly string[] = ['period', 'interval', 'activity'];

function parseRows(v: unknown, name: string): TemplateRow[] {
  if (!Array.isArray(v) || v.length > MAX_ROWS) invalid(`${name} must be a list of up to ${MAX_ROWS} rows`);
  return (v as unknown[]).map((raw) => {
    const r = obj(raw, 'row');
    if (typeof r.type !== 'string' || !ROW_TYPES.includes(r.type)) invalid('row type must be period, interval or activity');
    if (typeof r.start !== 'string' || typeof r.end !== 'string' || r.start.length > MAX_TIME_LEN || r.end.length > MAX_TIME_LEN) invalid('row start and end are required');
    const row: TemplateRow = { type: r.type as TemplateRow['type'], start: r.start as string, end: r.end as string };
    if (row.type === 'activity') {
      const nameEn = optStr(r.nameEn, 'nameEn');
      const nameSi = optStr(r.nameSi, 'nameSi');
      const subjectId = optDocId(r.subjectId, 'subjectId');
      if (nameEn !== undefined) row.nameEn = nameEn;
      if (nameSi !== undefined) row.nameSi = nameSi;
      if (subjectId !== undefined) row.subjectId = subjectId;
    }
    return row;
  });
}

function parsePatch(v: unknown): TemplatePatch {
  const p = obj(v, 'patch');
  if (p.mode !== 'same' && p.mode !== 'perDay') invalid('mode must be same or perDay');
  const patch: TemplatePatch = { name: str(p.name, 'name'), mode: p.mode as TemplatePatch['mode'], rows: [] };
  if (patch.mode === 'perDay') {
    const days = obj(p.days, 'days');
    patch.days = Object.fromEntries(DAY_INDEXES.map((d) => [d, parseRows(days[d], `days.${d}`)])) as Record<DayIndex, TemplateRow[]>;
    patch.rows = patch.days[DAY_INDEXES[0]!];
  } else {
    patch.rows = parseRows(p.rows, 'rows');
  }
  if (validateTemplate(patch).length > 0) invalid('Template rows are not valid');
  return patch;
}

export const saveTemplate = onCall(callOpts, async (req): Promise<SaveTemplateRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const templateId = docId(data.templateId, 'templateId');
  const patch = parsePatch(data.patch);
  const dryRun = data.dryRun === true;

  const subjectIds = [...new Set([...patch.rows, ...Object.values(patch.days ?? {}).flat()].flatMap((r) => (r.subjectId ? [r.subjectId] : [])))];

  const ref = db.doc(`${paths.templates(sid)}/${templateId}`);
  const yid = await latestYearId(sid);
  return runTx(async (tx) => {
    if (subjectIds.length > 0) {
      const found = await tx.getAll(...subjectIds.map((id) => db.doc(`${paths.subjects(sid)}/${id}`)));
      if (found.some((d) => !d.exists)) invalid('Unknown subject on an activity row');
    }
    const [snap, classes, year] = await Promise.all([
      tx.get(ref),
      tx.get(db.collection(paths.classes(sid)).where('templateId', '==', templateId)),
      yid ? tx.get(db.doc(`${paths.years(sid)}/${yid}`)) : undefined,
    ]);
    const entrySnap = classes.size > 0 && yid ? await tx.get(db.collection(paths.entries(sid, yid))) : undefined;
    if (!snap.exists) fail('not-found', 'invalid', 'Unknown template');
    const before = { ...(snap.data() as Omit<PeriodTemplate, 'id'>), id: templateId };
    const after: PeriodTemplate = { ...before, name: patch.name, mode: patch.mode, rows: patch.rows };
    delete after.days;
    if (patch.days) after.days = patch.days;

    const entries = entrySnap ? entrySnap.docs.map((d) => ({ ...(d.data() as Omit<Entry, 'id'>), id: d.id })) : [];
    const { moves, blocked, orphaned } = remapEntries(before, after, entries, classes.docs.map((c) => c.id));
    const res: SaveTemplateRes = { moved: moves.length, blocked: blocked.length, orphaned: orphaned.length };
    if (dryRun) return res;
    if (year) assertNotApplying(year);
    if (blocked.length > 0) fail('failed-precondition', 'template-in-use', 'Used periods cannot become activities or intervals', { count: blocked.length });
    if (moves.length + 1 > BATCH_LIMIT) fail('failed-precondition', 'template-too-many-moves', 'Too many timetable entries would move in one save', { count: moves.length });

    for (const m of moves) tx.update(db.doc(`${paths.entries(sid, yid!)}/${m.entryId}`), { period: m.period });
    tx.update(ref, { name: patch.name, mode: patch.mode, rows: patch.rows, days: patch.days ?? FieldValue.delete() });
    return res;
  });
});
