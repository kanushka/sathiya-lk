// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { CENSUS_NO_RE, padCensusNo, suggestStaffPrefix, titleCase, type MoeLang, type MoeSchool, type SchoolType } from '@sathiya/core';

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
  medium: MoeLang[];
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

export const emptySchool: SchoolDraft = { type: 'government', censusNo: '', noCensus: false, nameEn: '', nameSi: '', district: '', city: '', address: '', phone: '', gradeFrom: 1, gradeTo: 13, staffPrefix: '', medium: [] };
export const defaultBrand: BrandDraft = { logo: null, primary: '#0E6B6A', second: '#D9A441' };
export const emptyAccount: AccountDraft = { adminName: '', email: '', password: '', terms: false };

export const prefixOk = (p: string) => /^[A-Z]{2,5}$/.test(p);
export const gradesOk = (s: SchoolDraft) => s.gradeFrom <= s.gradeTo;
export const censusValid = (c: string) => CENSUS_NO_RE.test(c);
export const censusError = (s: SchoolDraft): 'format' | null => (s.censusNo !== '' && !censusValid(s.censusNo) ? 'format' : null);
const censusOk = (s: SchoolDraft) => (s.type !== 'government' && s.noCensus ? s.censusNo === '' : censusValid(s.censusNo));
export const schoolOk = (s: SchoolDraft) =>
  censusOk(s) &&
  (s.nameEn.trim() !== '' || s.nameSi.trim() !== '') && s.district.trim() !== '' && s.city.trim() !== '' && prefixOk(s.staffPrefix) && gradesOk(s);

export function gradeList(s: SchoolDraft): number[] {
  return Array.from({ length: s.gradeTo - s.gradeFrom + 1 }, (_, i) => s.gradeFrom + i);
}

export const MEDIA: readonly MoeLang[] = ['si', 'en', 'ta'];

export { DISTRICTS } from '@sathiya/core';

export const siFirst = (medium: readonly MoeLang[] | undefined) => !!medium?.includes('si');

// The MOE list has no town column; the last address segment ("…, Colombo 13") is the closest thing to a city.
export function cityFromAddress(address: string): string {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length ? titleCase(parts[parts.length - 1]!) : '';
}

export function listedDraft(moe: MoeSchool, prev: SchoolDraft): SchoolDraft {
  const name = titleCase(moe.name);
  const grades = moe.grades.length ? moe.grades : [prev.gradeFrom, prev.gradeTo];
  return {
    ...emptySchool,
    type: 'government',
    censusNo: padCensusNo(moe.censusNo),
    nameEn: name,
    nameSi: padCensusNo(prev.censusNo) === padCensusNo(moe.censusNo) ? prev.nameSi : '',
    district: moe.district ?? '',
    city: cityFromAddress(moe.address),
    address: moe.address ? titleCase(moe.address) : '',
    gradeFrom: Math.min(...grades),
    gradeTo: Math.max(...grades),
    staffPrefix: suggestStaffPrefix(name),
    medium: [...moe.media],
  };
}

export const listedOk = (s: SchoolDraft) =>
  prefixOk(s.staffPrefix) && s.district.trim() !== '' && s.city.trim() !== '' && (!siFirst(s.medium) || s.nameSi.trim() !== '');
