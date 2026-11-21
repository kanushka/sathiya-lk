import { isValidStaffId, paths, syntheticEmail, type CreateTeacherRes, type Teacher } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { setSchoolClaims } from './lib/claims';
import { bool, email, fail, int, intList, invalid, obj, optStr, requireSchoolAdmin, str, strList } from './lib/guards';
import { newPassword } from './lib/password';

const duplicate = (staffId: string): never => fail('already-exists', 'invalid', `Staff ID ${staffId} is already used`, { field: 'staffId' });

export const createTeacher = onCall(callOpts, async (req): Promise<CreateTeacherRes> => {
  const data = obj(req.data, 'request');
  const { sid, school } = await requireSchoolAdmin(req, data.schoolId);
  const t = obj(data.teacher, 'teacher');
  const staffId = str(t.staffId, 'staffId', 10);
  if (!isValidStaffId(school.staffPrefix, staffId)) invalid(`staffId must look like ${school.staffPrefix}001`);
  const teacher: Omit<Teacher, 'id'> = {
    staffId,
    name: str(t.name, 'name'),
    isPrimary: bool(t.isPrimary, 'isPrimary'),
    subjectIds: strList(t.subjectIds, 'subjectIds'),
    grades: intList(t.grades, 'grades', 1, 13),
    maxPerDay: int(t.maxPerDay, 'maxPerDay', 1, 20),
    phone: optStr(t.phone, 'phone', 30),
    email: t.email === undefined || t.email === null || t.email === '' ? undefined : email(t.email),
  };

  const teachers = db.collection(paths.teachers(sid));
  if (!(await teachers.where('staffId', '==', staffId).limit(1).get()).empty) duplicate(staffId);

  const password = newPassword();
  // The synthetic email is unique in Auth, so a concurrent create of the same staff ID fails here.
  const user = await auth
    .createUser({ email: syntheticEmail(staffId, sid), password, displayName: teacher.name })
    .catch((e: { code?: string }) => (e.code === 'auth/email-already-exists' ? duplicate(staffId) : Promise.reject(e)));

  const ref = teachers.doc();
  try {
    const batch = db.batch();
    batch.create(ref, { ...teacher, uid: user.uid });
    batch.create(db.doc(`${paths.members(sid)}/${user.uid}`), { uid: user.uid, role: 'teacher', teacherId: ref.id });
    await batch.commit();
    await setSchoolClaims(user.uid, { sid, role: 'teacher', tid: ref.id });
  } catch (e) {
    await auth.deleteUser(user.uid).catch(() => undefined);
    throw e;
  }
  return { teacherId: ref.id, password };
});
