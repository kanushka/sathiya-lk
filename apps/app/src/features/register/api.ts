// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { DEFAULT_TERMS_VERSION, paths, type LookupCensusRes, type RegisterSchoolReq } from '@sathiya/core';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { call } from '../../lib/callable';
import { auth, db, storage } from '../../lib/firebase';

export const FALLBACK_TERMS_VERSION = DEFAULT_TERMS_VERSION;

export async function createAccount(email: string, password: string, displayName: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName }).catch(() => undefined);
}

export async function confirmVerified(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}

export async function currentTermsVersion(): Promise<string> {
  try {
    const snap = await getDoc(doc(db, paths.platform.config));
    const v = snap.data()?.currentTermsVersion;
    return typeof v === 'string' && v ? v : FALLBACK_TERMS_VERSION;
  } catch {
    return FALLBACK_TERMS_VERSION;
  }
}

export async function registerSchool(req: RegisterSchoolReq): Promise<string> {
  const res = await call('registerSchool', req);
  return res.schoolId;
}

export function lookupCensus(censusNo: string): Promise<LookupCensusRes> {
  return call('lookupCensus', { censusNo });
}

const LOGO_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function uploadLogo(schoolId: string, file: File): Promise<string> {
  const ext = LOGO_EXT[file.type];
  if (!ext) throw new Error(`Unsupported logo type ${file.type}`);
  const fileRef = ref(storage, `schools/${schoolId}/logo.${ext}`);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const url = await getDownloadURL(fileRef);
  await updateDoc(doc(db, paths.school(schoolId)), { logoUrl: url });
  return url;
}
