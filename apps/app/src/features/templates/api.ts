// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type DayIndex, type SaveTemplateRes, type TemplatePatch, type TemplateRow } from '@sathiya/core';
import { addDoc, collection, doc, writeBatch } from 'firebase/firestore';
import { call } from '../../lib/callable';
import { db } from '../../lib/firebase';

export function cleanRows(rows: TemplateRow[]): TemplateRow[] {
  return rows.map((r) => {
    const out: TemplateRow = { type: r.type, start: r.start, end: r.end };
    if (r.type !== 'activity') return out;
    const nameEn = r.nameEn?.trim();
    const nameSi = r.nameSi?.trim();
    if (nameEn) out.nameEn = nameEn;
    if (nameSi) out.nameSi = nameSi;
    if (r.subjectId) out.subjectId = r.subjectId;
    return out;
  });
}

function cleanPatch(patch: TemplatePatch): TemplatePatch {
  const out: TemplatePatch = { name: patch.name.trim(), mode: patch.mode, rows: cleanRows(patch.rows) };
  if (patch.mode === 'perDay' && patch.days) {
    out.days = Object.fromEntries(([0, 1, 2, 3, 4] as DayIndex[]).map((d) => [d, cleanRows(patch.days![d])])) as TemplatePatch['days'] & object;
  }
  return out;
}

export function saveTemplateWithRemap(schoolId: string, templateId: string, patch: TemplatePatch, dryRun = false): Promise<SaveTemplateRes> {
  return call('saveTemplate', { schoolId, templateId, patch: cleanPatch(patch), ...(dryRun ? { dryRun } : {}) });
}

export async function createTemplate(schoolId: string, name: string, rows: TemplateRow[]): Promise<void> {
  await addDoc(collection(db, paths.templates(schoolId)), { name: name.trim(), isDefault: false, mode: 'same', rows: cleanRows(rows) });
}

export async function setDefaultTemplate(schoolId: string, templateId: string, previousDefaultIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const id of previousDefaultIds) {
    if (id !== templateId) batch.update(doc(db, paths.templates(schoolId), id), { isDefault: false });
  }
  batch.update(doc(db, paths.templates(schoolId), templateId), { isDefault: true });
  await batch.commit();
}
