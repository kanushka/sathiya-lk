// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { DAY_INDEXES, paths, remapEntries, validateTemplate, type DayIndex, type PeriodTemplate, type SaveTemplateRes, type TemplatePatch, type TemplateRow } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { docId, fail, invalid, obj, optDocId, optStr, requireSchoolAdmin, str } from './lib/guards';
import { latestYearId } from './lib/yearEntries';
import { loadEntries } from './lib/loadContext';

const BATCH_LIMIT = 450;
const MAX_ROWS = 40;
const ROW_TYPES: readonly string[] = ['period', 'interval', 'activity'];

function parseRows(v: unknown, name: string): TemplateRow[] {
  if (!Array.isArray(v) || v.length > MAX_ROWS) invalid(`${name} must be a list of up to ${MAX_ROWS} rows`);
  return (v as unknown[]).map((raw) => {
    const r = obj(raw, 'row');
    if (typeof r.type !== 'string' || !ROW_TYPES.includes(r.type)) invalid('row type must be period, interval or activity');
    if (typeof r.start !== 'string' || typeof r.end !== 'string') invalid('row start and end are required');
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
  const patch: TemplatePatch = { name: str(p.name, 'name'), mode: p.mode as TemplatePatch['mode'], rows: parseRows(p.rows, 'rows') };
  if (patch.mode === 'perDay') {
    const days = obj(p.days, 'days');
    patch.days = Object.fromEntries(DAY_INDEXES.map((d) => [d, parseRows(days[d], `days.${d}`)])) as Record<DayIndex, TemplateRow[]>;
  }
  if (validateTemplate(patch).length > 0) invalid('Template rows are not valid');
  return patch;
}

export const saveTemplate = onCall(callOpts, async (req): Promise<SaveTemplateRes> => {
  const data = obj(req.data, 'request');
  const { sid } = await requireSchoolAdmin(req, data.schoolId);
  const templateId = docId(data.templateId, 'templateId');
  const patch = parsePatch(data.patch);

  const ref = db.doc(`${paths.templates(sid)}/${templateId}`);
  const [snap, classes, yid] = await Promise.all([
    ref.get(),
    db.collection(paths.classes(sid)).where('templateId', '==', templateId).get(),
    latestYearId(sid),
  ]);
  if (!snap.exists) fail('not-found', 'invalid', 'Unknown template');
  const before = { ...(snap.data() as Omit<PeriodTemplate, 'id'>), id: templateId };
  const after: PeriodTemplate = { ...before, name: patch.name, mode: patch.mode, rows: patch.rows };
  delete after.days;
  if (patch.days) after.days = patch.days;

  const entries = yid && classes.size > 0 ? await loadEntries(sid, yid) : [];
  const { moves, blocked } = remapEntries(before, after, entries, classes.docs.map((c) => c.id));
  if (blocked.length > 0) fail('failed-precondition', 'template-in-use', 'Used periods cannot become activities', { count: blocked.length });

  // Entries first: a failure part-way leaves the template unchanged, and a retry recomputes the remaining moves.
  for (let i = 0; i < moves.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const m of moves.slice(i, i + BATCH_LIMIT)) batch.update(db.doc(`${paths.entries(sid, yid!)}/${m.entryId}`), { period: m.period });
    await batch.commit();
  }
  await ref.update({ name: patch.name, mode: patch.mode, rows: patch.rows, days: patch.days ?? FieldValue.delete() });
  return { moved: moves.length };
});
