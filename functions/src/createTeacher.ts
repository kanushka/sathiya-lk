// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { isValidStaffId, TEACHER_TITLES, type CreateTeacherRes, type Teacher, type TeacherTitle } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { callOpts } from './lib/callOptions';
import { bool, docIdList, email, int, intList, invalid, obj, optStr, requireSchoolAdmin, str } from './lib/guards';
import { createTeacherAccount } from './lib/teacherAccount';

const optTitle = (v: unknown): TeacherTitle | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (!(TEACHER_TITLES as readonly unknown[]).includes(v)) invalid(`title must be one of ${TEACHER_TITLES.join(', ')}`);
  return v as TeacherTitle;
};

export const createTeacher = onCall(callOpts, async (req): Promise<CreateTeacherRes> => {
  const data = obj(req.data, 'request');
  const { sid, school } = await requireSchoolAdmin(req, data.schoolId);
  const t = obj(data.teacher, 'teacher');
  const staffId = str(t.staffId, 'staffId', 10);
  if (!isValidStaffId(school.staffPrefix, staffId)) invalid(`staffId must look like ${school.staffPrefix}001`);
  const teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'> = {
    staffId,
    title: optTitle(t.title),
    name: str(t.name, 'name'),
    isPrimary: bool(t.isPrimary, 'isPrimary'),
    subjectIds: docIdList(t.subjectIds, 'subjectIds'),
    grades: intList(t.grades, 'grades', 1, 13),
    maxPerDay: int(t.maxPerDay, 'maxPerDay', 1, 20),
    phone: optStr(t.phone, 'phone', 30),
    email: t.email === undefined || t.email === null || t.email === '' ? undefined : email(t.email),
  };

  return createTeacherAccount(sid, teacher);
});
