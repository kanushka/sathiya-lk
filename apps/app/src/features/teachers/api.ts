// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type CreateTeacherRes, type Teacher } from '@sathiya/core';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { call } from '../../lib/callable';
import { db } from '../../lib/firebase';

export type TeacherInput = Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'>;

export function createTeacher(schoolId: string, teacher: TeacherInput): Promise<CreateTeacherRes> {
  return call('createTeacher', { schoolId, teacher });
}

export async function resetTeacherPassword(_schoolId: string, _teacherId: string): Promise<string> {
  throw new Error('resetTeacherPassword was removed');
}

export async function updateTeacher(schoolId: string, teacherId: string, teacher: TeacherInput): Promise<void> {
  const { title, nameSi, phone, email, ...rest } = teacher;
  await updateDoc(doc(db, paths.teachers(schoolId), teacherId), {
    ...rest,
    title: title ? title : deleteField(),
    nameSi: nameSi ? nameSi : deleteField(),
    phone: phone ? phone : deleteField(),
    email: email ? email : deleteField(),
  });
}
