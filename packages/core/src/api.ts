// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ImportRow, SubjectColumn, TeacherColumn } from './importSheet';
import type { AuthEmailKind, EntryDraft, Lang, ReportReason, School, Teacher, TeacherTitle } from './types';

export const callables = {
  registerSchool: 'registerSchool',
  createTeacher: 'createTeacher',
  importSetup: 'importSetup',
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
  setJoinLink: 'setJoinLink',
  joinSchool: 'joinSchool',
  decideJoinRequest: 'decideJoinRequest',
  createTeacherLink: 'createTeacherLink',
  cancelTeacherLink: 'cancelTeacherLink',
  unlinkTeacher: 'unlinkTeacher',
  linkSelf: 'linkSelf',
} as const;

export interface RegisterSchoolReq { school: Omit<School, 'id' | 'status' | 'createdAt' | 'activeYearId'>; adminName: string; acceptedTermsVersion: string }
export interface RegisterSchoolRes { schoolId: string }
export interface CreateTeacherReq { schoolId: string; teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'> }
export interface CreateTeacherRes { teacherId: string }
export interface ImportSetupReq { schoolId: string; subjectsVersion: string; subjects: ImportRow<SubjectColumn>[]; teachers: ImportRow<TeacherColumn>[] }
export interface ImportSetupRes { subjectIds: string[]; teachers: { teacherId: string; staffId: string; name: string; nameSi?: string; title?: TeacherTitle }[]; notCreated: string[] }
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
export interface SetJoinLinkReq { schoolId: string; action: 'create' | 'off' }
export interface SetJoinLinkRes { token?: string }
export interface JoinSchoolReq { schoolId?: string; token: string; staffId?: string }
export interface JoinSchoolRes { status: 'linked' | 'pending'; schoolId: string; teacherId?: string }
export interface DecideJoinRequestReq { schoolId: string; uid: string; approve: boolean }
export interface DecideJoinRequestRes { ok: true }
export interface CreateTeacherLinkReq { schoolId: string; teacherId: string }
export interface CreateTeacherLinkRes { token: string; expiresAt: number }
export interface CancelTeacherLinkReq { schoolId: string; teacherId: string }
export interface CancelTeacherLinkRes { ok: true }
export interface UnlinkTeacherReq { schoolId: string; teacherId: string }
export interface UnlinkTeacherRes { ok: true }
export interface LinkSelfReq { schoolId: string; teacherId: string }
export interface LinkSelfRes { ok: true }
interface CallableMap {
  registerSchool: { req: RegisterSchoolReq; res: RegisterSchoolRes };
  createTeacher: { req: CreateTeacherReq; res: CreateTeacherRes };
  importSetup: { req: ImportSetupReq; res: ImportSetupRes };
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
  setJoinLink: { req: SetJoinLinkReq; res: SetJoinLinkRes };
  joinSchool: { req: JoinSchoolReq; res: JoinSchoolRes };
  decideJoinRequest: { req: DecideJoinRequestReq; res: DecideJoinRequestRes };
  createTeacherLink: { req: CreateTeacherLinkReq; res: CreateTeacherLinkRes };
  cancelTeacherLink: { req: CancelTeacherLinkReq; res: CancelTeacherLinkRes };
  unlinkTeacher: { req: UnlinkTeacherReq; res: UnlinkTeacherRes };
  linkSelf: { req: LinkSelfReq; res: LinkSelfRes };
}
export type CallableName = keyof typeof callables;
export type CallableTypes = { [K in CallableName]: CallableMap[K] };
export type ApiErrorCode = 'clash' | 'in-use' | 'not-allowed' | 'invalid' | 'census-taken' | 'email-unverified' | 'already-has-school' | 'rate-limited' | 'school-disabled' | 'already-linked' | 'staff-id-unknown' | 'link-invalid' | 'too-many-schools' | 'school-registered';
