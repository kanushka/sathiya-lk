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
export interface InviteAdminRes { ok: true }
export type ClaimInvitesReq = Record<string, never>;
export interface ClaimInvitesRes { schoolIds: string[] }
export interface SaveEntryReq { schoolId: string; yearId: string; entry: EntryDraft }
export interface SaveEntryRes { entryId: string }
export interface DeleteEntryReq { schoolId: string; yearId: string; entryId: string }
export interface DeleteEntryRes { ok: true }
export interface PublishYearReq { schoolId: string; yearId: string }
export interface PublishYearRes { classes: number; teachers: number }
export interface SetSchoolStatusReq { schoolId: string; status: 'active' | 'disabled' }
export interface SetSchoolStatusRes { ok: true }
export interface DeleteSetupItemReq { schoolId: string; kind: 'teacher' | 'subject' | 'class' | 'template'; id: string }
export interface DeleteSetupItemRes { deleted: boolean; usedIn: number }
interface CallableMap {
  registerSchool: { req: RegisterSchoolReq; res: RegisterSchoolRes };
  createTeacher: { req: CreateTeacherReq; res: CreateTeacherRes };
  resetTeacherPassword: { req: ResetTeacherPasswordReq; res: ResetTeacherPasswordRes };
  inviteAdmin: { req: InviteAdminReq; res: InviteAdminRes };
  claimInvites: { req: ClaimInvitesReq; res: ClaimInvitesRes };
  saveEntry: { req: SaveEntryReq; res: SaveEntryRes };
  deleteEntry: { req: DeleteEntryReq; res: DeleteEntryRes };
  publishYear: { req: PublishYearReq; res: PublishYearRes };
  setSchoolStatus: { req: SetSchoolStatusReq; res: SetSchoolStatusRes };
  deleteSetupItem: { req: DeleteSetupItemReq; res: DeleteSetupItemRes };
}
export type CallableName = keyof typeof callables;
export type CallableTypes = { [K in CallableName]: CallableMap[K] };
export type ApiErrorCode = 'clash' | 'in-use' | 'not-allowed' | 'invalid';
