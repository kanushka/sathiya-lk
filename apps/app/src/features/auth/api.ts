import { paths } from '@sathiya/core';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { call } from '../../lib/callable';

export interface DirectorySchool {
  id: string;
  nameEn: string;
  nameSi?: string;
  district: string;
  status: 'active' | 'disabled';
}

function toDirectorySchool(id: string, data: Record<string, unknown>): DirectorySchool {
  return {
    id,
    nameEn: String(data.nameEn ?? ''),
    ...(typeof data.nameSi === 'string' && data.nameSi ? { nameSi: data.nameSi } : {}),
    district: String(data.district ?? ''),
    status: data.status === 'disabled' ? 'disabled' : 'active',
  };
}

export async function searchSchools(prefix: string): Promise<DirectorySchool[]> {
  const q = prefix.trim().toLowerCase();
  if (!q) return [];
  const snap = await getDocs(
    query(
      collection(db, 'schoolDirectory'),
      where('nameLower', '>=', q),
      where('nameLower', '<=', `${q}\uf8ff`),
      orderBy('nameLower'),
      limit(10),
    ),
  );
  return snap.docs.map((d) => toDirectorySchool(d.id, d.data())).filter((s) => s.status === 'active');
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
