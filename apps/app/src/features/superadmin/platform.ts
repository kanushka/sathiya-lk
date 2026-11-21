import { paths } from '@sathiya/core';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface Announcement {
  textEn: string;
  textSi?: string;
  active: boolean;
  updatedAt: number;
}

export interface PlatformConfig {
  currentTermsVersion: string;
  announcement?: Announcement;
}

export interface DefaultSubject {
  nameEn: string;
  nameSi: string;
  short: string;
  color: string;
}

export interface DefaultSubjectsDoc {
  subjects: DefaultSubject[];
  updatedAt: number;
}

export interface TermsVersion {
  version: string;
  termsMd: string;
  privacyMd: string;
  publishedAt: number;
}

export interface PlatformWriter {
  saveDefaultSubjects(doc: DefaultSubjectsDoc): Promise<void>;
  saveAnnouncement(a: Announcement): Promise<void>;
  publishTerms(v: TermsVersion): Promise<void>;
}

export const firestorePlatformWriter: PlatformWriter = {
  saveDefaultSubjects: (d) => setDoc(doc(db, paths.platform.defaultSubjects), d),
  saveAnnouncement: (announcement) => setDoc(doc(db, paths.platform.config), { announcement }, { merge: true }),
  async publishTerms(v) {
    const batch = writeBatch(db);
    batch.set(doc(db, paths.platform.terms(v.version)), v);
    batch.set(doc(db, paths.platform.config), { currentTermsVersion: v.version }, { merge: true });
    await batch.commit();
  },
};

export const hexColor = /^#[0-9A-Fa-f]{6}$/;
