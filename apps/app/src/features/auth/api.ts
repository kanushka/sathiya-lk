// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { auth, db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { call, toApiError } from '../../lib/callable';
import { mergeDirectoryResults, type DirectorySchool } from './directory';

export type { DirectorySchool };

function toDirectorySchool(id: string, data: Record<string, unknown>): DirectorySchool {
  return {
    id,
    nameEn: String(data.nameEn ?? ''),
    ...(typeof data.nameSi === 'string' && data.nameSi ? { nameSi: data.nameSi } : {}),
    district: String(data.district ?? ''),
    ...(typeof data.city === 'string' && data.city ? { city: data.city } : {}),
    status: data.status === 'disabled' ? 'disabled' : 'active',
  };
}

async function prefixQuery(field: 'nameLower' | 'cityLower', q: string): Promise<DirectorySchool[]> {
  const snap = await getDocs(
    query(
      collection(db, 'schoolDirectory'),
      where(field, '>=', q),
      where(field, '<=', `${q}\uf8ff`),
      orderBy(field),
      limit(10),
    ),
  );
  return snap.docs.map((d) => toDirectorySchool(d.id, d.data())).filter((s) => s.status === 'active');
}

export async function searchSchools(prefix: string): Promise<DirectorySchool[]> {
  const q = prefix.trim().toLowerCase();
  if (!q) return [];
  const [byName, byCity] = await Promise.all([prefixQuery('nameLower', q), prefixQuery('cityLower', q)]);
  return mergeDirectoryResults(byName, byCity);
}

export async function getDirectorySchool(id: string): Promise<DirectorySchool | null> {
  const snap = await getDoc(doc(db, paths.directory(id)));
  if (!snap.exists()) return null;
  const school = toDirectorySchool(snap.id, snap.data());
  return school.status === 'active' ? school : null;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function claimInvites(): Promise<void> {
  await call('claimInvites', {});
}

export type ReportReason = 'fake' | 'duplicate' | 'abuse' | 'other';
export interface ReportSchoolReq {
  schoolId: string;
  reason: ReportReason;
  details?: string;
  email?: string;
}

export async function reportSchool(req: ReportSchoolReq): Promise<void> {
  try {
    await httpsCallable<ReportSchoolReq, { ok: true }>(functions, 'reportSchool')(req);
  } catch (err) {
    throw toApiError(err);
  }
}
