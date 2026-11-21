// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export type Lang = 'en' | 'si';
export type DayIndex = 0 | 1 | 2 | 3 | 4;
export type Hhmm = string;
export interface Bilingual { nameEn: string; nameSi?: string }
export interface School extends Bilingual { id: string; district: string; city: string; address?: string; phone?: string; type: SchoolType; censusNo?: string; grades: number[]; staffPrefix: string; logoUrl?: string; colors: { primary: string; second: string }; status: 'active' | 'disabled'; termsVersion: string; activeYearId?: string; createdAt: number }
export type SchoolType = 'government' | 'private' | 'international';
export type ReportReason = 'fake' | 'duplicate' | 'abuse' | 'other';
export interface SchoolReport { id: string; schoolId: string; reason: ReportReason; details?: string; email?: string; createdAt: number; status: 'open' | 'closed' }
export interface SchoolDirectoryEntry extends Bilingual { district: string; city: string; status: 'active' | 'disabled' }
export interface Teacher { id: string; staffId: string; name: string; isPrimary: boolean; subjectIds: string[]; grades: number[]; maxPerDay: number; phone?: string; email?: string; uid?: string; lastLoginAt?: number }
export interface Subject extends Bilingual { id: string; short: string; color: string }
export interface TemplateRow { type: 'period' | 'interval'; start: Hhmm; end: Hhmm }
export interface PeriodTemplate { id: string; name: string; isDefault: boolean; mode: 'same' | 'perDay'; rows: TemplateRow[]; days?: Record<DayIndex, TemplateRow[]> }
export type PlanItem = { kind: 'subject'; subjectId: string; perWeek: number } | { kind: 'group'; key: string; nameEn: string; nameSi?: string; optionSubjectIds: string[]; perWeek: number };
export interface Grade { id: string; number: number; plan: PlanItem[] }
export interface SchoolClass { id: string; gradeId: string; name: string; classTeacherId?: string; templateId: string; planOverride?: PlanItem[] }
export interface Lesson { subjectId: string; teacherId: string | null }
export interface Entry { id: string; day: DayIndex; period: number; classIds: string[]; lessons: Lesson[]; teacherIds: string[]; groupKey?: string }
export type EntryDraft = Omit<Entry, 'id' | 'teacherIds'> & { id?: string };
export interface Year { id: string; label: string; status: 'draft' | 'published'; publishedAt?: number }
export interface Member { uid: string; role: 'admin' | 'teacher'; teacherId?: string; email?: string }
export interface Claims { sid?: string; role?: 'admin' | 'teacher'; tid?: string; super?: boolean }
export interface SchoolContext { school: School; teachers: Teacher[]; subjects: Subject[]; templates: PeriodTemplate[]; grades: Grade[]; classes: SchoolClass[] }
