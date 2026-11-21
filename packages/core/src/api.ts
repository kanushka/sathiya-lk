import type { EntryDraft, School, Teacher } from './types';

export const callables = {
  registerSchool: 'registerSchool',
  createTeacher: 'createTeacher',
  resetTeacherPassword: 'resetTeacherPassword',
  inviteAdmin: 'inviteAdmin',
  claimInvites: 'claimInvites',
  saveEntry: 'saveEntry',
  deleteEntry: 'deleteEntry',
  publishYear: 'publishYear',
  setSchoolStatus: 'setSchoolStatus',
  deleteSetupItem: 'deleteSetupItem',
} as const;

export interface RegisterSchoolReq { school: Omit<School, 'id' | 'status' | 'createdAt' | 'activeYearId'>; adminName: string; acceptedTermsVersion: string }
export interface RegisterSchoolRes { schoolId: string }
export interface CreateTeacherReq { schoolId: string; teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'> }
export interface CreateTeacherRes { teacherId: string; password: string }
export interface ResetTeacherPasswordReq { schoolId: string; teacherId: string }
export interface ResetTeacherPasswordRes { password: string }
export interface InviteAdminReq { schoolId: string; email: string; teacherId?: string }
export interface SaveEntryReq { schoolId: string; yearId: string; entry: EntryDraft }
export interface SaveEntryRes { entryId: string }
export interface DeleteEntryReq { schoolId: string; yearId: string; entryId: string }
export interface PublishYearReq { schoolId: string; yearId: string }
export interface SetSchoolStatusReq { schoolId: string; status: 'active' | 'disabled' }
export interface DeleteSetupItemReq { schoolId: string; kind: 'teacher' | 'subject' | 'class' | 'template'; id: string }
export interface DeleteSetupItemRes { deleted: boolean; usedIn: number }
export type ApiErrorCode = 'clash' | 'in-use' | 'not-allowed' | 'invalid';
