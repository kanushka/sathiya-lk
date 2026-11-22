// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { normalizeTeacher, paths, type Entry, type SchoolContext } from '@sathiya/core';
import { db } from './admin';

async function list<T>(path: string): Promise<T[]> {
  const snap = await db.collection(path).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T);
}

export async function loadContext(sid: string): Promise<SchoolContext> {
  const [school, teachers, subjects, templates, grades, classes] = await Promise.all([
    db.doc(paths.school(sid)).get(),
    list<SchoolContext['teachers'][number]>(paths.teachers(sid)),
    list<SchoolContext['subjects'][number]>(paths.subjects(sid)),
    list<SchoolContext['templates'][number]>(paths.templates(sid)),
    list<SchoolContext['grades'][number]>(paths.grades(sid)),
    list<SchoolContext['classes'][number]>(paths.classes(sid)),
  ]);
  if (!school.exists) throw new Error(`School ${sid} not found`);
  return { school: { ...(school.data() as SchoolContext['school']), id: sid }, teachers: teachers.map(normalizeTeacher), subjects, templates, grades, classes };
}

export const loadEntries = (sid: string, yid: string): Promise<Entry[]> => list<Entry>(paths.entries(sid, yid));
