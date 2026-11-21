// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { RegisterSchoolReq, School } from '@sathiya/core';

export type SchoolType = 'government' | 'private' | 'international';
export type SchoolContact = { city: string; address?: string; phone?: string; type: SchoolType; censusNo?: string };
export type SchoolWithContact = Omit<School, 'city'> & Partial<SchoolContact>;
export type RegisterSchoolWithContactReq = Omit<RegisterSchoolReq, 'school'> & {
  school: RegisterSchoolReq['school'] & SchoolContact;
};

export interface SchoolDraft {
  type: SchoolType;
  censusNo: string;
  noCensus: boolean;
  nameEn: string;
  nameSi: string;
  district: string;
  city: string;
  address: string;
  phone: string;
  gradeFrom: number;
  gradeTo: number;
  staffPrefix: string;
}

export interface BrandDraft {
  logo: File | null;
  primary: string;
  second: string;
}

export interface AccountDraft {
  adminName: string;
  email: string;
  password: string;
  terms: boolean;
}

export const emptySchool: SchoolDraft = { type: 'government', censusNo: '', noCensus: false, nameEn: '', nameSi: '', district: '', city: '', address: '', phone: '', gradeFrom: 1, gradeTo: 13, staffPrefix: '' };
export const defaultBrand: BrandDraft = { logo: null, primary: '#0E6B6A', second: '#D9A441' };
export const emptyAccount: AccountDraft = { adminName: '', email: '', password: '', terms: false };

export const prefixOk = (p: string) => /^[A-Z]{2,5}$/.test(p);
export const gradesOk = (s: SchoolDraft) => s.gradeFrom <= s.gradeTo;
export const censusValid = (c: string) => /^\d{4,6}$/.test(c);
export const censusError = (s: SchoolDraft): 'format' | null => (s.censusNo !== '' && !censusValid(s.censusNo) ? 'format' : null);
const censusOk = (s: SchoolDraft) => (s.type !== 'government' && s.noCensus ? s.censusNo === '' : censusValid(s.censusNo));
export const schoolOk = (s: SchoolDraft) =>
  censusOk(s) &&
  s.nameEn.trim() !== '' && s.district.trim() !== '' && s.city.trim() !== '' && prefixOk(s.staffPrefix) && gradesOk(s);

export function gradeList(s: SchoolDraft): number[] {
  return Array.from({ length: s.gradeTo - s.gradeFrom + 1 }, (_, i) => s.gradeFrom + i);
}
