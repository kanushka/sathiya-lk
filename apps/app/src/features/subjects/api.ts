// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Subject } from '@sathiya/core';
import { addDoc, collection, deleteField, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export type SubjectInput = Omit<Subject, 'id'>;

export function cleanSubject(s: SubjectInput): SubjectInput {
  const nameSi = s.nameSi?.trim();
  return { nameEn: s.nameEn.trim(), ...(nameSi ? { nameSi } : {}), short: s.short.trim(), color: s.color };
}

export async function addSubject(schoolId: string, subject: SubjectInput): Promise<void> {
  await addDoc(collection(db, paths.subjects(schoolId)), cleanSubject(subject));
}

export async function addSubjects(schoolId: string, subjects: SubjectInput[]): Promise<void> {
  const batch = writeBatch(db);
  for (const s of subjects) batch.set(doc(collection(db, paths.subjects(schoolId))), cleanSubject(s));
  await batch.commit();
}

export async function updateSubject(schoolId: string, subjectId: string, subject: SubjectInput): Promise<void> {
  const { nameSi, ...rest } = cleanSubject(subject);
  await updateDoc(doc(db, paths.subjects(schoolId), subjectId), { ...rest, nameSi: nameSi ?? deleteField() });
}

export async function fetchDefaultSubjects(): Promise<SubjectInput[]> {
  const snap = await getDoc(doc(db, paths.platform.defaultSubjects));
  const list = snap.data()?.subjects;
  return Array.isArray(list) ? (list as SubjectInput[]) : [];
}
