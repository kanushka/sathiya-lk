// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { randomUUID } from 'node:crypto';
import type { CallableName, CallableTypes, Claims, RegisterSchoolReq as RegisterSchoolInput } from '@sathiya/core';
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
import { linkTeacher } from '../src/lib/linkTeacher';
import { syncClaims } from '../src/lib/claims';
import { syncSchoolDirectory } from '../src/syncDirectory';
import { runTx } from '../src/lib/tx';
import { afterAll, beforeEach, expect } from 'vitest';

export const PROJECT_ID = 'sathiya-lk';
export const TERMS_VERSION = '1';
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

// Every SDK call comes from the same emulator IP; reset per-IP/per-uid counters so tests don't hit each other's limits.
beforeEach(async () => {
  await adminDb.recursiveDelete(adminDb.collection('rateLimits'));
  await adminDb.doc('platform/config').set({ currentTermsVersion: TERMS_VERSION }, { merge: true });
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
      const { schools } = claims as Claims;
      return { ...(schools ? { schools } : {}), ...(claims.super ? { super: true } : {}) };
    },
    get uid() {
      return auth.currentUser?.uid ?? '';
    },
  };
}

export async function signUp(email = `u-${uniq()}@example.com`, password = 'secret123', verified = true): Promise<Client> {
  const c = client();
  await createUserWithEmailAndPassword(c.auth, email, password);
  if (verified) {
    await adminAuth.updateUser(c.uid, { emailVerified: true });
    await c.auth.currentUser!.getIdToken(true);
  }
  return c;
}

export const unverifiedSignUp = (email?: string) => signUp(email, undefined, false);

export async function signInGoogle(email: string, emailVerified = false, name?: string): Promise<Client> {
  const c = client();
  const idToken = JSON.stringify({ sub: `g-${uniq()}`, email, email_verified: emailVerified, ...(name ? { name } : {}) });
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
      type: 'private',
      ...over,
    },
    adminName: 'Principal',
    acceptedTermsVersion: '1',
  };
}

// Registers an unlisted school, which starts pending review.
export async function pendingSchool(over: Partial<RegisterSchoolInput['school']> = {}): Promise<{ admin: Client; sid: string }> {
  const admin = await signUp();
  const { schoolId } = await admin.call('registerSchool', schoolReq(over));
  await admin.auth.currentUser!.getIdToken(true);
  return { admin, sid: schoolId };
}

// Approves directly, writing the directory entry now rather than waiting for the trigger.
export async function approve(sid: string): Promise<void> {
  await adminDb.doc(`schools/${sid}`).update({ status: 'active' });
  await syncSchoolDirectory(sid);
}

export async function adminWithSchool(): Promise<{ admin: Client; sid: string }> {
  const r = await pendingSchool();
  await approve(r.sid);
  return r;
}

export const teacherInput = (staffId: string) => ({
  staffId,
  name: 'Mrs. K. Perera',
  isPrimary: false,
  subjectIds: ['s-maths'],
  grades: [6, 7],
  maxPerDay: 6,
});

export async function linkedTeacher(admin: Client, sid: string, staffId: string): Promise<{ teacher: Client; teacherId: string }> {
  const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput(staffId) });
  const teacher = await signUp();
  await runTx((tx) => linkTeacher(tx, sid, teacherId, teacher.uid, {}));
  await syncClaims(teacher.uid);
  await teacher.auth.currentUser!.getIdToken(true);
  return { teacher, teacherId };
}

export const randomCensus = () => String(100_000 + Math.floor(Math.random() * 900_000));

export interface RawResult {
  status: number;
  result?: unknown;
  error?: { status: string; message: string; details?: { code?: string } };
}

// Callable over plain HTTP so a test can set X-Forwarded-For (the client SDK can't set headers).
// `ip` is sent as the last (front-end appended) X-Forwarded-For hop; `spoof` as a client-supplied hop before it.
export async function rawCall(
  name: string,
  data: unknown,
  opts: { ip?: string; spoof?: string; client?: Client } = {},
): Promise<RawResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.ip) headers['X-Forwarded-For'] = opts.spoof ? `${opts.spoof}, ${opts.ip}` : opts.ip;
  const user = opts.client?.auth.currentUser;
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  const res = await fetch(`http://${HOST}:5001/${PROJECT_ID}/us-central1/${name}`, { method: 'POST', headers, body: JSON.stringify({ data }) });
  return { status: res.status, ...((await res.json()) as object) };
}

export const rawErr = (r: RawResult) => ({ status: r.error?.status, code: r.error?.details?.code });

export async function expectFnError(p: Promise<unknown>, code: string, apiCode: string): Promise<void> {
  const err = (await p.then(
    () => {
      throw new Error(`expected ${code}, call succeeded`);
    },
    (e: unknown) => e,
  )) as { code?: string; details?: { code?: string } };
  expect({ code: err.code, apiCode: err.details?.code }).toEqual({ code: `functions/${code}`, apiCode });
}
