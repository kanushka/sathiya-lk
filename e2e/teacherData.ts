// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { buildSnapshots, paths, type ReliefDay, type Year } from '@sathiya/core';
import { C, S, T, ctx, entries } from '@sathiya/core/fixtures';
import { FieldValue } from 'firebase-admin/firestore';
import { admin, SID, YEAR_ID } from '../scripts/seed';

type Restore = () => Promise<void>;

/**
 * Publishes the fixture timetable straight into the emulator, so a teacher spec does not depend on
 * which entries earlier specs added or on the functions emulator. The restore puts back every doc it touched.
 */
export async function publishFixtureTimetable(): Promise<Restore> {
  const { db } = admin();
  const year: Year = { id: YEAR_ID, label: '2027', status: 'published', publishedAt: Date.now() };
  const built = buildSnapshots(ctx, entries, year);
  const docs: Array<[string, Record<string, unknown>]> = [
    [`${paths.years(SID)}/${YEAR_ID}`, { label: year.label, status: year.status, publishedAt: year.publishedAt }],
    ...built.classes.map((c): [string, Record<string, unknown>] => [paths.publishedClass(SID, YEAR_ID, c.classId), { ...c }]),
    ...built.teachers.map((t): [string, Record<string, unknown>] => [paths.publishedTeacher(SID, YEAR_ID, t.teacherId), { ...t }]),
  ];
  const before = await Promise.all(docs.map(async ([path]) => [path, (await db.doc(path).get()).data()] as const));
  const batch = db.batch();
  for (const [path, data] of docs) batch.set(db.doc(path), data);
  await batch.commit();
  return async () => {
    const undo = db.batch();
    for (const [path, data] of before) {
      if (data) undo.set(db.doc(path), data);
      else undo.delete(db.doc(path));
    }
    await undo.commit();
  };
}

/** Sets one field on a doc and returns a restore that puts the old value back. */
export async function setField(path: string, field: string, value: unknown): Promise<Restore> {
  const { db } = admin();
  const old = (await db.doc(path).get()).get(field) as unknown;
  await db.doc(path).update({ [field]: value });
  return async () => {
    await db.doc(path).update({ [field]: old === undefined ? FieldValue.delete() : old });
  };
}

/** Writes relief days for the given dates and returns a restore that deletes them again. */
export async function writeReliefDays(days: ReliefDay[]): Promise<Restore> {
  const { db } = admin();
  const before = await Promise.all(days.map(async (d) => (await db.doc(paths.reliefDay(SID, YEAR_ID, d.date)).get()).data()));
  const batch = db.batch();
  for (const d of days) batch.set(db.doc(paths.reliefDay(SID, YEAR_ID, d.date)), d);
  await batch.commit();
  return async () => {
    const undo = db.batch();
    days.forEach((d, i) => {
      const old = before[i];
      if (old) undo.set(db.doc(paths.reliefDay(SID, YEAR_ID, d.date)), old);
      else undo.delete(db.doc(paths.reliefDay(SID, YEAR_ID, d.date)));
    });
    await undo.commit();
  };
}

/** Wednesday 4 March 2026, 09:20 in Colombo: Mrs. N. Perera teaches 6B Maths in P3. Far from any date the relief spec uses. */
export const TEACHER_NOW = new Date('2026-03-04T09:20:00+05:30');
export const TODAY = '2026-03-04';
export const TOMORROW = '2026-03-05';

const names = {
  [T.rSilva]: { en: 'Mr. R. Silva' },
  [T.perera]: { en: 'Mrs. N. Perera' },
  [T.wijesekara]: { en: 'Ms. A. Wijesekara' },
};

/** Mr. R. Silva is away on Wednesday: Mrs. N. Perera covers his 6B Sinhala in P6, his 6B History in P8 has no relief.
 * On Thursday Ms. A. Wijesekara is away and Mrs. N. Perera covers her 6B English in P5. */
export const reliefDays: ReliefDay[] = [
  {
    date: TODAY,
    day: 2,
    leaves: [{ teacherId: T.rSilva, type: 'full', entryIds: ['e-6b-2-6', 'e-6b-2-8'] }],
    reliefs: [
      { entryId: 'e-6b-2-6', absentTeacherId: T.rSilva, day: 2, period: 6, start: '11:30', end: '12:10', classIds: [C.c6b], subjectId: S.sinhala, reliefTeacherId: T.perera },
      { entryId: 'e-6b-2-8', absentTeacherId: T.rSilva, day: 2, period: 8, start: '12:50', end: '13:30', classIds: [C.c6b], subjectId: S.history, reliefTeacherId: null },
    ],
    names,
    labels: { [`e-6b-2-6|${T.rSilva}`]: { cls: '6B', sub: 'Sinhala', subSi: 'සිංහල' }, [`e-6b-2-8|${T.rSilva}`]: { cls: '6B', sub: 'History' } },
    updatedAt: 1,
    updatedBy: 'seed-admin',
  },
  {
    date: TOMORROW,
    day: 3,
    leaves: [{ teacherId: T.wijesekara, type: 'full', entryIds: ['e-6b-3-5'] }],
    reliefs: [{ entryId: 'e-6b-3-5', absentTeacherId: T.wijesekara, day: 3, period: 5, start: '10:50', end: '11:30', classIds: [C.c6b], subjectId: S.english, reliefTeacherId: T.perera }],
    names,
    labels: { [`e-6b-3-5|${T.wijesekara}`]: { cls: '6B', sub: 'English' } },
    updatedAt: 1,
    updatedBy: 'seed-admin',
  },
];
