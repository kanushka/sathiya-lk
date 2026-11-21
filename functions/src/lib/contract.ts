// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
// Local mirror of contract additions that live on another branch of @sathiya/core (merged in Phase 6). Drop once core has them.
import type { ApiErrorCode, RegisterSchoolReq } from '@sathiya/core';

export const SCHOOL_TYPES = ['government', 'private', 'international'] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export const CENSUS_NO_RE = /^\d{4,6}$/;

export type ApiErrorCodeExt = ApiErrorCode | 'census-taken' | 'email-unverified' | 'already-has-school' | 'rate-limited';

export type RegisterSchoolInput = Omit<RegisterSchoolReq, 'school'> & {
  school: RegisterSchoolReq['school'] & { city: string; address?: string; phone?: string; type: SchoolType; censusNo?: string };
};

export const REPORT_REASONS = ['fake', 'duplicate', 'abuse', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface ReportSchoolReq {
  schoolId: string;
  reason: ReportReason;
  details?: string;
  email?: string;
}
export interface ReportSchoolRes {
  ok: true;
}
