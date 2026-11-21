
import { paths, type DayIndex, type TemplateRow } from '@sathiya/core';
import { addDoc, collection, deleteField, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export function cleanRows(rows: TemplateRow[]): TemplateRow[] {
  return rows.map((r) => ({ type: r.type, start: r.start, end: r.end }));
}

export interface TemplatePatch {
  name: string;
  mode: 'same' | 'perDay';
  rows: TemplateRow[];
  days?: Record<DayIndex, TemplateRow[]>;
}

export async function createTemplate(schoolId: string, name: string, rows: TemplateRow[]): Promise<void> {
  await addDoc(collection(db, paths.templates(schoolId)), { name: name.trim(), isDefault: false, mode: 'same', rows: cleanRows(rows) });
}

export async function saveTemplate(schoolId: string, templateId: string, patch: TemplatePatch): Promise<void> {
  const days =
    patch.mode === 'perDay' && patch.days
      ? Object.fromEntries(([0, 1, 2, 3, 4] as DayIndex[]).map((d) => [d, cleanRows(patch.days![d])]))
      : deleteField();
  await updateDoc(doc(db, paths.templates(schoolId), templateId), {
    name: patch.name.trim(),
    mode: patch.mode,
    rows: cleanRows(patch.rows),
    days,
  });
}

export async function setDefaultTemplate(schoolId: string, templateId: string, previousDefaultIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const id of previousDefaultIds) {
    if (id !== templateId) batch.update(doc(db, paths.templates(schoolId), id), { isDefault: false });
  }
  batch.update(doc(db, paths.templates(schoolId), templateId), { isDefault: true });
  await batch.commit();
}
