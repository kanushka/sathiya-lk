// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { randomUUID } from 'node:crypto';
import type { CallableName, CallableTypes, Claims } from '@sathiya/core';
import { initializeApp as initAdmin, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { afterAll, expect } from 'vitest';
import type { RegisterSchoolInput } from '../src/registerSchool';

export const PROJECT_ID = 'sathiya-lk';
const HOST = '127.0.0.1';

process.env.FIRESTORE_EMULATOR_HOST ??= `${HOST}:8080`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${HOST}:9099`;

if (!getAdminApps().length) initAdmin({ projectId: PROJECT_ID });
export const adminDb = getFirestore();
export const adminAuth = getAdminAuth();

const apps: FirebaseApp[] = [];
afterAll(async () => {
  await Promise.all(apps.splice(0).map((a) => deleteApp(a)));
});

export interface Client {
  app: FirebaseApp;
  auth: Auth;
  functions: Functions;
  call<K extends CallableName>(name: K, req: CallableTypes[K]['req']): Promise<CallableTypes[K]['res']>;
  claims(): Promise<Claims>;
  uid: string;
}

export const uniq = () => randomUUID().slice(0, 8);

export function client(): Client {
  const app = initializeApp({ apiKey: 'fake-api-key', projectId: PROJECT_ID }, `c-${uniq()}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const functions = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(functions, HOST, 5001);
  return {
    app,
    auth,
    functions,
    async call(name, req) {
      const res = await httpsCallable(functions, name)(req);
      return res.data as never;
    },
    async claims() {
      const user = auth.currentUser;
      if (!user) return {};
      const { claims } = await user.getIdTokenResult(true);
      const { sid, role, tid } = claims as Claims;
      return { sid, role, tid, ...(claims.super ? { super: true } : {}) } as Claims;
    },
    get uid() {
      return auth.currentUser?.uid ?? '';
    },
  };
}

export async function signUp(email = `u-${uniq()}@example.com`, password = 'secret123'): Promise<Client> {
  const c = client();
  await createUserWithEmailAndPassword(c.auth, email, password);
  return c;
}

export async function signInGoogle(email: string, emailVerified = false): Promise<Client> {
  const c = client();
  const idToken = JSON.stringify({ sub: `g-${uniq()}`, email, email_verified: emailVerified });
  await signInWithCredential(c.auth, GoogleAuthProvider.credential(idToken));
  return c;
}

export async function signIn(email: string, password: string): Promise<Client> {
  const c = client();
  await signInWithEmailAndPassword(c.auth, email, password);
  return c;
}

export async function makeSuper(c: Client): Promise<void> {
  const user = await adminAuth.getUser(c.uid);
  await adminAuth.setCustomUserClaims(c.uid, { ...(user.customClaims ?? {}), super: true });
  await c.auth.currentUser!.getIdToken(true);
}

export function schoolReq(over: Partial<RegisterSchoolInput['school']> = {}): RegisterSchoolInput {
  return {
    school: {
      nameEn: 'Siripura Central College',
      nameSi: 'සිරිපුර මධ්‍ය විද්‍යාලය',
      district: 'Kurunegala',
      city: 'Siripura',
      grades: [6, 7, 8, 9, 10, 11],
      staffPrefix: 'SCC',
      colors: { primary: '#7A1F3D', second: '#D9A441' },
      termsVersion: '1',
      ...over,
    },
    adminName: 'Principal',
    acceptedTermsVersion: '1',
  };
}

export async function adminWithSchool(): Promise<{ admin: Client; sid: string }> {
  const admin = await signUp();
  const { schoolId } = await admin.call('registerSchool', schoolReq());
  await admin.auth.currentUser!.getIdToken(true);
  return { admin, sid: schoolId };
}

export const teacherInput = (staffId: string) => ({
  staffId,
  name: 'Mrs. K. Perera',
  isPrimary: false,
  subjectIds: ['s-maths'],
  grades: [6, 7],
  maxPerDay: 6,
});

export async function expectFnError(p: Promise<unknown>, code: string, apiCode: string): Promise<void> {
  const err = (await p.then(
    () => {
      throw new Error(`expected ${code}, call succeeded`);
    },
    (e: unknown) => e,
  )) as { code?: string; details?: { code?: string } };
  expect({ code: err.code, apiCode: err.details?.code }).toEqual({ code: `functions/${code}`, apiCode });
}
