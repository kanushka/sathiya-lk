// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Entry, type EntryDraft } from '@sathiya/core';
import { ctx } from '@sathiya/core/fixtures';
import { adminDb, adminWithSchool, type Client } from './helpers';

export const YEAR = 'y2027';

// Replaces the school's registered setup data with the Siripura fixtures (same ids) and adds a draft year.
export async function seedSchool(sid: string): Promise<void> {
  const old = await adminDb.collection(paths.templates(sid)).get();
  const batch = adminDb.batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  const put = (col: string, items: Array<{ id: string }>) => {
    for (const { id, ...rest } of items) batch.set(adminDb.doc(`${col}/${id}`), rest);
  };
  put(paths.teachers(sid), ctx.teachers);
  put(paths.subjects(sid), ctx.subjects);
  put(paths.templates(sid), ctx.templates);
  put(paths.grades(sid), ctx.grades);
  put(paths.classes(sid), ctx.classes);
  batch.set(adminDb.doc(`${paths.years(sid)}/${YEAR}`), { label: '2027', status: 'draft' });
  await batch.commit();
}

export async function seededSchool(): Promise<{ admin: Client; sid: string }> {
  const r = await adminWithSchool();
  await seedSchool(r.sid);
  return r;
}

export async function putEntries(sid: string, entries: Entry[], yid = YEAR): Promise<void> {
  const batch = adminDb.batch();
  for (const { id, ...rest } of entries) batch.set(adminDb.doc(`${paths.entries(sid, yid)}/${id}`), rest);
  await batch.commit();
}

export const draft = (day: number, period: number, classIds: string[], lessons: Array<[string, string | null]>, extra: Partial<EntryDraft> = {}): EntryDraft => ({
  day: day as EntryDraft['day'],
  period,
  classIds,
  lessons: lessons.map(([subjectId, teacherId]) => ({ subjectId, teacherId })),
  ...extra,
});

export async function entriesOf(sid: string, yid = YEAR): Promise<Entry[]> {
  const snap = await adminDb.collection(paths.entries(sid, yid)).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry);
}
