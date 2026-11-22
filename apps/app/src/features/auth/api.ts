// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type CallableTypes } from '@sathiya/core';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { call } from '../../lib/callable';
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
  return snap.exists() ? toDirectorySchool(snap.id, snap.data()) : null;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function claimInvites(): Promise<void> {
  await call('claimInvites', {});
}

export async function reportSchool(req: CallableTypes['reportSchool']['req']): Promise<void> {
  await call('reportSchool', req);
}

export async function applyEmailCode(oobCode: string): Promise<void> {
  await applyActionCode(auth, oobCode);
}

export async function getResetEmail(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

export async function confirmNewPassword(oobCode: string, password: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, password);
}

export async function getRecoveredEmail(oobCode: string): Promise<string> {
  const info = await checkActionCode(auth, oobCode);
  return info.data.email ?? '';
}
