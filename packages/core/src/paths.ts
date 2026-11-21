// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export const paths = {
  school: (sid: string) => `schools/${sid}`,
  teachers: (sid: string) => `schools/${sid}/teachers`,
  subjects: (sid: string) => `schools/${sid}/subjects`,
  templates: (sid: string) => `schools/${sid}/periodTemplates`,
  grades: (sid: string) => `schools/${sid}/grades`,
  classes: (sid: string) => `schools/${sid}/classes`,
  members: (sid: string) => `schools/${sid}/members`,
  invites: (sid: string) => `schools/${sid}/invites`,
  years: (sid: string) => `schools/${sid}/years`,
  user: (uid: string) => `users/${uid}`,
  publishedClasses: (sid: string, yid: string) => `schools/${sid}/years/${yid}/publishedClasses`,
  publishedTeachers: (sid: string, yid: string) => `schools/${sid}/years/${yid}/publishedTeachers`,
  entries: (sid: string, yid: string) => `schools/${sid}/years/${yid}/entries`,
  publishedClass: (sid: string, yid: string, cid: string) => `schools/${sid}/years/${yid}/publishedClasses/${cid}`,
  publishedTeacher: (sid: string, yid: string, tid: string) => `schools/${sid}/years/${yid}/publishedTeachers/${tid}`,
  directory: (sid: string) => `schoolDirectory/${sid}`,
  censusIndex: (censusNo: string) => `censusIndex/${censusNo}`,
  reports: () => 'reports',
  report: (id: string) => `reports/${id}`,
  platform: {
    config: 'platform/config',
    defaultSubjects: 'platform/defaultSubjects',
    terms: (v: string) => `platform/terms/versions/${v}`,
  },
} as const;
