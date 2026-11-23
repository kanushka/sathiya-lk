// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ImportRow, SubjectColumn, TeacherColumn } from './importSheet';
import type { AuthEmailKind, EntryDraft, Lang, ReportReason, School, Teacher, TeacherTitle } from './types';

export const callables = {
  registerSchool: 'registerSchool',
  createTeacher: 'createTeacher',
  importSetup: 'importSetup',
  resetTeacherPassword: 'resetTeacherPassword',
  inviteAdmin: 'inviteAdmin',
  claimInvites: 'claimInvites',
  saveEntry: 'saveEntry',
  deleteEntry: 'deleteEntry',
  publishYear: 'publishYear',
  setSchoolStatus: 'setSchoolStatus',
  deleteSetupItem: 'deleteSetupItem',
  reportSchool: 'reportSchool',
  sendAuthEmail: 'sendAuthEmail',
  releaseCensusNo: 'releaseCensusNo',
  checkCensusNo: 'checkCensusNo',
  recordSignIn: 'recordSignIn',
} as const;

export interface RegisterSchoolReq { school: Omit<School, 'id' | 'status' | 'createdAt' | 'activeYearId'>; adminName: string; acceptedTermsVersion: string }
export interface RegisterSchoolRes { schoolId: string }
export interface CreateTeacherReq { schoolId: string; teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'> }
export interface CreateTeacherRes { teacherId: string; password: string }
export interface ImportSetupReq { schoolId: string; subjectsVersion: string; subjects: ImportRow<SubjectColumn>[]; teachers: ImportRow<TeacherColumn>[] }
export interface ImportSetupRes { subjectIds: string[]; teachers: { teacherId: string; staffId: string; name: string; nameSi?: string; title?: TeacherTitle; password: string }[]; notCreated: string[] }
export interface ResetTeacherPasswordReq { schoolId: string; teacherId: string }
export interface ResetTeacherPasswordRes { password: string }
export interface InviteAdminReq { schoolId: string; email: string; teacherId?: string }
export interface InviteAdminRes { ok: true }
export type ClaimInvitesReq = Record<string, never>;
export interface ClaimInvitesRes { schoolIds: string[] }
export type RecordSignInReq = Record<string, never>;
export interface RecordSignInRes { recorded: boolean }
export interface SaveEntryReq { schoolId: string; yearId: string; entry: EntryDraft }
export interface SaveEntryRes { entryId: string }
export interface DeleteEntryReq { schoolId: string; yearId: string; entryId: string }
export interface DeleteEntryRes { ok: true }
export interface PublishYearReq { schoolId: string; yearId: string }
export interface PublishYearRes { classes: number; teachers: number }
export interface SetSchoolStatusReq { schoolId: string; status: 'active' | 'disabled' }
export interface SetSchoolStatusRes { ok: true }
export interface DeleteSetupItemReq { schoolId: string; kind: 'teacher' | 'subject' | 'class' | 'template' | 'grade'; id: string }
export interface DeleteSetupItemRes { deleted: boolean; usedIn: number }
export interface ReportSchoolReq { schoolId: string; reason: ReportReason; details?: string; email?: string }
export interface ReportSchoolRes { ok: true }
export interface SendAuthEmailReq { kind: AuthEmailKind; email?: string; lang: Lang }
export interface SendAuthEmailRes { ok: true }
export interface ReleaseCensusNoReq { schoolId: string }
export interface ReleaseCensusNoRes { censusNo: string; freed: boolean }
export interface CheckCensusNoReq { censusNo: string }
export interface CheckCensusNoRes { available: boolean }
interface CallableMap {
  registerSchool: { req: RegisterSchoolReq; res: RegisterSchoolRes };
  createTeacher: { req: CreateTeacherReq; res: CreateTeacherRes };
  importSetup: { req: ImportSetupReq; res: ImportSetupRes };
  resetTeacherPassword: { req: ResetTeacherPasswordReq; res: ResetTeacherPasswordRes };
  inviteAdmin: { req: InviteAdminReq; res: InviteAdminRes };
  claimInvites: { req: ClaimInvitesReq; res: ClaimInvitesRes };
  saveEntry: { req: SaveEntryReq; res: SaveEntryRes };
  deleteEntry: { req: DeleteEntryReq; res: DeleteEntryRes };
  publishYear: { req: PublishYearReq; res: PublishYearRes };
  setSchoolStatus: { req: SetSchoolStatusReq; res: SetSchoolStatusRes };
  deleteSetupItem: { req: DeleteSetupItemReq; res: DeleteSetupItemRes };
  reportSchool: { req: ReportSchoolReq; res: ReportSchoolRes };
  sendAuthEmail: { req: SendAuthEmailReq; res: SendAuthEmailRes };
  releaseCensusNo: { req: ReleaseCensusNoReq; res: ReleaseCensusNoRes };
  checkCensusNo: { req: CheckCensusNoReq; res: CheckCensusNoRes };
  recordSignIn: { req: RecordSignInReq; res: RecordSignInRes };
}
export type CallableName = keyof typeof callables;
export type CallableTypes = { [K in CallableName]: CallableMap[K] };
export type ApiErrorCode = 'clash' | 'in-use' | 'not-allowed' | 'invalid' | 'census-taken' | 'email-unverified' | 'already-has-school' | 'rate-limited' | 'school-disabled';
