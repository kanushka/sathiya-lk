// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type CreateTeacherLinkRes, type CreateTeacherRes, type SetJoinLinkRes, type Teacher } from '@sathiya/core';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { call } from '../../lib/callable';
import { db } from '../../lib/firebase';

export type TeacherInput = Omit<Teacher, 'id' | 'uid' | 'lastLoginAt' | 'inviteExpiresAt'>;

export function createTeacher(schoolId: string, teacher: TeacherInput): Promise<CreateTeacherRes> {
  return call('createTeacher', { schoolId, teacher });
}

export async function setJoinLink(schoolId: string, action: 'create' | 'off'): Promise<SetJoinLinkRes> {
  return call('setJoinLink', { schoolId, action });
}

export async function decideJoinRequest(schoolId: string, uid: string, approve: boolean): Promise<void> {
  await call('decideJoinRequest', { schoolId, uid, approve });
}

export function createTeacherLink(schoolId: string, teacherId: string): Promise<CreateTeacherLinkRes> {
  return call('createTeacherLink', { schoolId, teacherId });
}

export async function cancelTeacherLink(schoolId: string, teacherId: string): Promise<void> {
  await call('cancelTeacherLink', { schoolId, teacherId });
}

export async function unlinkTeacher(schoolId: string, teacherId: string): Promise<void> {
  await call('unlinkTeacher', { schoolId, teacherId });
}

export async function linkSelf(schoolId: string, teacherId: string): Promise<void> {
  await call('linkSelf', { schoolId, teacherId });
}

export async function updateTeacher(schoolId: string, teacherId: string, teacher: TeacherInput): Promise<void> {
  const { title, nameSi, phone, email, minPerWeek, ...rest } = teacher;
  await updateDoc(doc(db, paths.teachers(schoolId), teacherId), {
    ...rest,
    title: title ? title : deleteField(),
    nameSi: nameSi ? nameSi : deleteField(),
    phone: phone ? phone : deleteField(),
    email: email ? email : deleteField(),
    minPerWeek: minPerWeek === undefined ? deleteField() : minPerWeek,
  });
}
