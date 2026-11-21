import { paths, type CreateTeacherRes, type Teacher } from '@sathiya/core';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { call } from '../../lib/callable';
import { db } from '../../lib/firebase';

export type TeacherInput = Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'>;

export function createTeacher(schoolId: string, teacher: TeacherInput): Promise<CreateTeacherRes> {
  return call('createTeacher', { schoolId, teacher });
}

export async function resetTeacherPassword(schoolId: string, teacherId: string): Promise<string> {
  const res = await call('resetTeacherPassword', { schoolId, teacherId });
  return res.password;
}

export async function updateTeacher(schoolId: string, teacherId: string, teacher: TeacherInput): Promise<void> {
  const { phone, email, ...rest } = teacher;
  await updateDoc(doc(db, paths.teachers(schoolId), teacherId), {
    ...rest,
    phone: phone ? phone : deleteField(),
    email: email ? email : deleteField(),
  });
}
