// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, syntheticEmail, teacherDisplayName, type Teacher } from '@sathiya/core';
import { auth, db } from './admin';
import { setSchoolClaims } from './claims';
import { fail } from './guards';
import { newPassword } from './password';

export const duplicateStaffId = (staffId: string): never => fail('already-exists', 'invalid', `Staff ID ${staffId} is already used`, { field: 'staffId' });

export const createTeacherAccount = async (
  sid: string,
  teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'>,
): Promise<{ teacherId: string; password: string }> => {
  const teachers = db.collection(paths.teachers(sid));
  if (!(await teachers.where('staffId', '==', teacher.staffId).limit(1).get()).empty) duplicateStaffId(teacher.staffId);

  const password = newPassword();
  // The synthetic email is unique in Auth, so a concurrent create of the same staff ID fails here.
  const user = await auth
    .createUser({ email: syntheticEmail(teacher.staffId, sid), password, displayName: teacherDisplayName(teacher) })
    .catch((e: { code?: string }) => (e.code === 'auth/email-already-exists' ? duplicateStaffId(teacher.staffId) : Promise.reject(e)));

  const ref = teachers.doc();
  // Claims first: if they fail nothing is written yet, and deleting the Auth user frees the staff ID.
  try {
    await setSchoolClaims(user.uid, { sid, role: 'teacher', tid: ref.id });
    const batch = db.batch();
    batch.create(ref, { ...teacher, uid: user.uid });
    batch.create(db.doc(`${paths.members(sid)}/${user.uid}`), { uid: user.uid, role: 'teacher', teacherId: ref.id });
    await batch.commit();
  } catch (e) {
    await auth.deleteUser(user.uid).catch(() => undefined);
    throw e;
  }
  return { teacherId: ref.id, password };
};
