// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Grade, type PlanItem, type SchoolClass } from '@sathiya/core';
import { addDoc, collection, deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const timing = (p: PlanItem) => ({
  ...(p.unit === 'minutes' ? { unit: 'minutes' as const } : {}),
  ...(p.unit === 'minutes' && p.perDay !== undefined ? { perDay: p.perDay } : {}),
});

export function cleanPlan(plan: PlanItem[]): PlanItem[] {
  return plan.map((p) => {
    if (p.kind === 'subject') return { kind: 'subject', subjectId: p.subjectId, perWeek: p.perWeek, ...timing(p) };
    const nameSi = p.nameSi?.trim();
    return {
      kind: 'group',
      key: p.key,
      nameEn: p.nameEn.trim(),
      ...(nameSi ? { nameSi } : {}),
      optionSubjectIds: [...p.optionSubjectIds],
      perWeek: p.perWeek,
      ...timing(p),
    };
  });
}

export type GradeStaffing = NonNullable<Grade['staffing']>;

export function cleanStaffing(staffing: GradeStaffing): GradeStaffing {
  return staffing.mode === 'classTeacherPlusSpecialists'
    ? { mode: staffing.mode, specialistSubjectIds: [...(staffing.specialistSubjectIds ?? [])] }
    : { mode: staffing.mode };
}

export async function addGrade(schoolId: string, number: number): Promise<void> {
  const grade: Omit<Grade, 'id'> = { number, plan: [] };
  await addDoc(collection(db, paths.grades(schoolId)), grade);
}

export async function saveGradePlan(schoolId: string, gradeId: string, plan: PlanItem[]): Promise<void> {
  await updateDoc(doc(db, paths.grades(schoolId), gradeId), { plan: cleanPlan(plan) });
}

export async function saveGradeStaffing(schoolId: string, gradeId: string, staffing: GradeStaffing): Promise<void> {
  await updateDoc(doc(db, paths.grades(schoolId), gradeId), { staffing: cleanStaffing(staffing) });
}

export type NewClass = Pick<SchoolClass, 'gradeId' | 'name' | 'templateId' | 'classTeacherId'>;

export async function addClass(schoolId: string, cls: NewClass): Promise<void> {
  const { classTeacherId, ...rest } = cls;
  await addDoc(collection(db, paths.classes(schoolId)), { ...rest, ...(classTeacherId ? { classTeacherId } : {}) });
}

export interface ClassPatch {
  classTeacherId?: string | null;
  templateId?: string;
}

export async function updateClass(schoolId: string, classId: string, patch: ClassPatch): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.templateId !== undefined) data.templateId = patch.templateId;
  if (patch.classTeacherId !== undefined) data.classTeacherId = patch.classTeacherId === null ? deleteField() : patch.classTeacherId;
  await updateDoc(doc(db, paths.classes(schoolId), classId), data);
}

export async function setPlanOverride(schoolId: string, classId: string, plan: PlanItem[] | null): Promise<void> {
  await updateDoc(doc(db, paths.classes(schoolId), classId), { planOverride: plan === null ? deleteField() : cleanPlan(plan) });
}
