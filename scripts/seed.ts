// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { directoryFields, paths, syntheticEmail, teacherDisplayName, type Entry } from '@sathiya/core';
import { ctx, entries, school, subjects } from '@sathiya/core/fixtures';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { pathToFileURL } from 'node:url';

export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'sathiya-lk';
export const HOST = '127.0.0.1';
export const PORTS = { auth: 9099, firestore: 8080, functions: 5001, storage: 9199 } as const;

export const SID = school.id;
export const YEAR_ID = 'y2027';
export const TERMS_VERSION = '1';

// Emulator-only test credentials.
export const ADMIN = { uid: 'seed-admin', email: 'admin@siripura.example.com', password: 'admin-pass-1', name: 'Principal Siripura' } as const;
export const SUPER = { uid: 'seed-super', email: 'super@sathiya.example.com', password: 'super-pass-1' } as const;
export const TEACHER_PASSWORD = 'teach234';

export const teacherLogin = (tid: string) => {
  const t = ctx.teachers.find((x) => x.id === tid);
  if (!t) throw new Error(`unknown teacher ${tid}`);
  return { uid: `seed-${t.id}`, staffId: t.staffId, email: syntheticEmail(t.staffId, SID), password: TEACHER_PASSWORD, name: teacherDisplayName(t) };
};

function useEmulators(): void {
  process.env.FIRESTORE_EMULATOR_HOST ??= `${HOST}:${PORTS.firestore}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${HOST}:${PORTS.auth}`;
  const hosts = [process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST];
  if (!hosts.every((h) => /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(h))) throw new Error(`Refusing to seed: emulator hosts must be local (${hosts.join(', ')})`);
}

export async function clearEmulators(): Promise<void> {
  const urls = [
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`,
  ];
  for (const url of urls) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} → ${res.status} ${await res.text()}`);
  }
}

export function admin(): { db: Firestore; auth: ReturnType<typeof getAuth> } {
  useEmulators();
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  return { db: getFirestore(), auth: getAuth() };
}

const strip = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

async function writeSchool(db: Firestore): Promise<void> {
  const batch = db.batch();
  const put = (col: string, items: Array<{ id: string }>) => {
    for (const item of items) batch.set(db.doc(`${col}/${item.id}`), strip(item));
  };
  const schoolDoc = { ...strip(school), activeYearId: YEAR_ID, termsVersion: TERMS_VERSION, createdAt: Date.now() };
  batch.set(db.doc(paths.school(SID)), schoolDoc);
  batch.set(db.doc(paths.directory(SID)), directoryFields(schoolDoc));
  batch.set(db.doc(paths.censusIndex(school.censusNo!)), { schoolId: SID });
  put(paths.subjects(SID), ctx.subjects);
  put(paths.templates(SID), ctx.templates);
  put(paths.grades(SID), ctx.grades);
  put(paths.classes(SID), ctx.classes);
  for (const t of ctx.teachers) batch.set(db.doc(`${paths.teachers(SID)}/${t.id}`), { ...strip(t), uid: teacherLogin(t.id).uid });
  batch.set(db.doc(`${paths.years(SID)}/${YEAR_ID}`), { label: '2027', status: 'draft' });
  put(paths.entries(SID, YEAR_ID), entries as Entry[]);
  batch.set(db.doc(paths.platform.config), { currentTermsVersion: TERMS_VERSION });
  batch.set(db.doc(paths.platform.defaultSubjects), {
    subjects: subjects.map(({ nameEn, nameSi, short, color }) => ({ nameEn, nameSi: nameSi ?? nameEn, short, color })),
    updatedAt: Date.now(),
  });
  await batch.commit();
}

async function writeAccounts(db: Firestore, auth: ReturnType<typeof getAuth>): Promise<void> {
  await auth.createUser({ uid: ADMIN.uid, email: ADMIN.email, password: ADMIN.password, emailVerified: true, displayName: ADMIN.name });
  await auth.setCustomUserClaims(ADMIN.uid, { sid: SID, role: 'admin' });
  await auth.createUser({ uid: SUPER.uid, email: SUPER.email, password: SUPER.password, emailVerified: true });
  await auth.setCustomUserClaims(SUPER.uid, { super: true });
  const batch = db.batch();
  batch.set(db.doc(`${paths.members(SID)}/${ADMIN.uid}`), { uid: ADMIN.uid, role: 'admin', email: ADMIN.email, name: ADMIN.name });
  batch.set(db.doc(paths.user(ADMIN.uid)), { schoolId: SID });
  for (const t of ctx.teachers) {
    const login = teacherLogin(t.id);
    await auth.createUser({ uid: login.uid, email: login.email, password: login.password, displayName: login.name });
    await auth.setCustomUserClaims(login.uid, { sid: SID, role: 'teacher', tid: t.id });
    batch.set(db.doc(`${paths.members(SID)}/${login.uid}`), { uid: login.uid, role: 'teacher', teacherId: t.id });
  }
  await batch.commit();
}

export async function seed(): Promise<void> {
  const { db, auth } = admin();
  await clearEmulators();
  await writeSchool(db);
  await writeAccounts(db, auth);
}

export function credentials(): string {
  const rows = ctx.teachers.map((t) => teacherLogin(t.id)).map((l) => `  ${l.staffId}  ${l.password}  ${l.name}`);
  return [
    `Seeded ${school.nameEn} (${SID}) into project ${PROJECT_ID}, draft year ${YEAR_ID}.`,
    `Admin:  ${ADMIN.email} / ${ADMIN.password}`,
    `Super:  ${SUPER.email} / ${SUPER.password}`,
    `Teachers (school "${school.nameEn}", staff ID / password):`,
    ...rows,
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seed().then(
    () => console.log(credentials()),
    (e: unknown) => {
      console.error(e);
      process.exit(1);
    },
  );
}
