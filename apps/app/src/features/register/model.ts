export interface SchoolDraft {
  nameEn: string;
  nameSi: string;
  district: string;
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

export const emptySchool: SchoolDraft = { nameEn: '', nameSi: '', district: '', gradeFrom: 1, gradeTo: 13, staffPrefix: '' };
export const defaultBrand: BrandDraft = { logo: null, primary: '#0E6B6A', second: '#D9A441' };
export const emptyAccount: AccountDraft = { adminName: '', email: '', password: '', terms: false };

export const prefixOk = (p: string) => /^[A-Z]{2,5}$/.test(p);
export const gradesOk = (s: SchoolDraft) => s.gradeFrom <= s.gradeTo;
export const schoolOk = (s: SchoolDraft) =>
  s.nameEn.trim() !== '' && s.district.trim() !== '' && prefixOk(s.staffPrefix) && gradesOk(s);

export function gradeList(s: SchoolDraft): number[] {
  return Array.from({ length: s.gradeTo - s.gradeFrom + 1 }, (_, i) => s.gradeFrom + i);
}
