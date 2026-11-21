import type { DirectorySchool } from './api';

export const SCHOOL_KEY = 'sathiya.school';

export function readRememberedSchool(): DirectorySchool | null {
  try {
    const raw = localStorage.getItem(SCHOOL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<DirectorySchool>;
    return typeof v.id === 'string' && typeof v.nameEn === 'string' ? (v as DirectorySchool) : null;
  } catch {
    return null;
  }
}

export function rememberSchool(school: DirectorySchool): void {
  try {
    localStorage.setItem(SCHOOL_KEY, JSON.stringify(school));
  } catch {
    return;
  }
}
