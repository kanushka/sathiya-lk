// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { doc, runTransaction, setDoc } from 'firebase/firestore';
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

export class TermsExistsError extends Error {
  constructor(public readonly version: string) {
    super(`Terms version ${version} already exists`);
    this.name = 'TermsExistsError';
  }
}

export const termsCollectionPath = paths.platform.terms('_').replace(/\/_$/, '');

export const firestorePlatformWriter: PlatformWriter = {
  saveDefaultSubjects: (d) => setDoc(doc(db, paths.platform.defaultSubjects), d),
  saveAnnouncement: ({ textSi, ...rest }) =>
    setDoc(doc(db, paths.platform.config), { announcement: { ...rest, ...(textSi !== undefined && { textSi }) } }, { merge: true }),
  async publishTerms(v) {
    const versionRef = doc(db, paths.platform.terms(v.version));
    await runTransaction(db, async (tx) => {
      if ((await tx.get(versionRef)).exists()) throw new TermsExistsError(v.version);
      tx.set(versionRef, v);
      tx.set(doc(db, paths.platform.config), { currentTermsVersion: v.version }, { merge: true });
    });
  },
};

export const hexColor = /^#[0-9A-Fa-f]{6}$/;
