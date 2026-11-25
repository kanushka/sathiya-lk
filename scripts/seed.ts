// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { directoryFields, MAX_SCHOOLS, paths, teacherDisplayName, type Claims, type Entry, type Member } from '@sathiya/core';
import { ctx, defaultTemplate, entries, school, subjects, T } from '@sathiya/core/fixtures';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
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
export const TEACHER_PASSWORD = 'teach-pass-1';
export const LINKED_TEACHERS = [T.perera, T.rSilva] as const;
export const JOIN_TOKEN = 'seed-join-token-siripura';
// Signed up and asked to join as this teacher; the admin has not decided yet.
export const REQUESTER = { uid: 'seed-requester', email: 'kumari@siripura.example.com', password: 'request-pass-1', name: 'D. Kumari', teacherId: T.kumari } as const;
// No account yet; signing up with this email and opening the school link links them straight away.
export const INVITEE = { email: 'bandara@siripura.example.com', teacherId: T.bandara } as const;
// Registered with a census number that is not in the MOE list, so it waits for super admin review.
export const PENDING_SCHOOL = { sid: 'seed-wattegama', nameEn: 'Wattegama M.V.', censusNo: '99001' } as const;
export const PENDING_ADMIN = { uid: 'seed-wattegama-admin', email: 'admin@wattegama.example.com', password: 'wattegama-pass-1', name: 'Principal Wattegama' } as const;

export const teacherLogin = (tid: string) => {
  const t = ctx.teachers.find((x) => x.id === tid);
  if (!t) throw new Error(`unknown teacher ${tid}`);
  const local = t.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
  return { uid: `seed-${t.id}`, staffId: t.staffId, email: `${local}@siripura.example.com`, password: TEACHER_PASSWORD, name: teacherDisplayName(t) };
};

export const joinPath = (sid = SID, token = JOIN_TOKEN) => `/join/${sid}/${token}`;
const requestedTeacher = () => ctx.teachers.find((t) => t.id === REQUESTER.teacherId)!;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

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
  for (const t of ctx.teachers) {
    const linked = (LINKED_TEACHERS as readonly string[]).includes(t.id);
    const email = linked ? teacherLogin(t.id).email : t.id === INVITEE.teacherId ? INVITEE.email : undefined;
    batch.set(db.doc(`${paths.teachers(SID)}/${t.id}`), { ...strip(t), ...(email && { email }), ...(linked && { uid: teacherLogin(t.id).uid }) });
  }
  batch.set(db.doc(paths.joinLink(SID)), { hash: sha256(JOIN_TOKEN), token: JOIN_TOKEN, createdAt: Date.now(), createdBy: ADMIN.uid });
  batch.set(db.doc(`${paths.years(SID)}/${YEAR_ID}`), { label: '2027', status: 'draft' });
  put(paths.entries(SID, YEAR_ID), entries as Entry[]);
  const pending = {
    nameEn: PENDING_SCHOOL.nameEn,
    district: 'Kandy',
    city: 'Wattegama',
    type: 'government',
    censusNo: PENDING_SCHOOL.censusNo,
    grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    medium: ['si'],
    staffPrefix: 'WMV',
    colors: { primary: '#1F4E79', second: '#D9A441' },
    status: 'pending',
    review: { moeMatched: false },
    termsVersion: TERMS_VERSION,
    createdAt: Date.now(),
  };
  batch.set(db.doc(paths.school(PENDING_SCHOOL.sid)), pending);
  batch.set(db.doc(paths.censusIndex(PENDING_SCHOOL.censusNo)), { schoolId: PENDING_SCHOOL.sid });
  batch.set(db.doc(`${paths.templates(PENDING_SCHOOL.sid)}/default`), { name: defaultTemplate.name, isDefault: true, mode: 'same', rows: defaultTemplate.rows });
  batch.set(db.doc(paths.platform.config), { currentTermsVersion: TERMS_VERSION });
  batch.set(db.doc(paths.platform.defaultSubjects), {
    subjects: subjects.map(({ nameEn, nameSi, short, color }) => ({ nameEn, nameSi: nameSi ?? nameEn, short, color })),
    updatedAt: Date.now(),
  });
  await batch.commit();
}

// Mirrors syncClaims in functions/src/lib/claims.ts.
async function syncClaims(db: Firestore, auth: ReturnType<typeof getAuth>, uid: string): Promise<void> {
  const [user, snap] = await Promise.all([auth.getUser(uid), db.collectionGroup('members').where('uid', '==', uid).get()]);
  if (snap.size > MAX_SCHOOLS) throw new Error(`${uid} is in more than ${MAX_SCHOOLS} schools`);
  const schools: NonNullable<Claims['schools']> = {};
  for (const doc of snap.docs) {
    const m = doc.data() as Member;
    schools[doc.ref.parent.parent!.id] = { r: m.role === 'admin' ? 'a' : 't', ...(m.teacherId && { t: m.teacherId }) };
  }
  const next: Claims = {};
  if (snap.size > 0) next.schools = schools;
  if (user.customClaims?.super === true) next.super = true;
  await auth.setCustomUserClaims(uid, next);
}

async function writeAccounts(db: Firestore, auth: ReturnType<typeof getAuth>): Promise<void> {
  await auth.createUser({ uid: ADMIN.uid, email: ADMIN.email, password: ADMIN.password, emailVerified: true, displayName: ADMIN.name });
  await auth.createUser({ uid: SUPER.uid, email: SUPER.email, password: SUPER.password, emailVerified: true });
  await auth.setCustomUserClaims(SUPER.uid, { super: true });
  await auth.createUser({ uid: PENDING_ADMIN.uid, email: PENDING_ADMIN.email, password: PENDING_ADMIN.password, emailVerified: true, displayName: PENDING_ADMIN.name });
  await auth.createUser({ uid: REQUESTER.uid, email: REQUESTER.email, password: REQUESTER.password, emailVerified: true, displayName: REQUESTER.name });
  const batch = db.batch();
  batch.set(db.doc(`${paths.members(SID)}/${ADMIN.uid}`), { uid: ADMIN.uid, role: 'admin', email: ADMIN.email, name: ADMIN.name });
  batch.set(db.doc(`${paths.members(PENDING_SCHOOL.sid)}/${PENDING_ADMIN.uid}`), { uid: PENDING_ADMIN.uid, role: 'admin', email: PENDING_ADMIN.email, name: PENDING_ADMIN.name });
  for (const tid of LINKED_TEACHERS) {
    const l = teacherLogin(tid);
    await auth.createUser({ uid: l.uid, email: l.email, password: l.password, emailVerified: true, displayName: l.name });
    batch.set(db.doc(`${paths.members(SID)}/${l.uid}`), { uid: l.uid, role: 'teacher', teacherId: tid, email: l.email, name: l.name });
  }
  const requested = requestedTeacher();
  batch.set(db.doc(`${paths.joinRequests(SID)}/${REQUESTER.uid}`), {
    uid: REQUESTER.uid,
    email: REQUESTER.email,
    name: REQUESTER.name,
    staffId: requested.staffId,
    teacherId: requested.id,
    createdAt: Date.now(),
    status: 'pending',
  });
  await batch.commit();
  for (const uid of [ADMIN.uid, PENDING_ADMIN.uid, ...LINKED_TEACHERS.map((tid) => teacherLogin(tid).uid)]) await syncClaims(db, auth, uid);
}

export async function seed(): Promise<void> {
  const { db, auth } = admin();
  await clearEmulators();
  await writeSchool(db);
  await writeAccounts(db, auth);
}

export function credentials(appUrl = 'http://localhost:5173'): string {
  const rows = LINKED_TEACHERS.map(teacherLogin).map((l) => `  ${l.email} / ${l.password}  (${l.staffId} ${l.name})`);
  return [
    `Seeded ${school.nameEn} (${SID}) into project ${PROJECT_ID}, draft year ${YEAR_ID}.`,
    `Admin:      ${ADMIN.email} / ${ADMIN.password}`,
    `Super:      ${SUPER.email} / ${SUPER.password}`,
    `Pending:    ${PENDING_ADMIN.email} / ${PENDING_ADMIN.password}  (admin of ${PENDING_SCHOOL.nameEn}, waiting for review)`,
    `Teachers:`,
    ...rows,
    `Requester:  ${REQUESTER.email} / ${REQUESTER.password}  (pending request for ${requestedTeacher().staffId})`,
    `Invitee:    sign up as ${INVITEE.email} and open the school link to link as ${INVITEE.teacherId}`,
    `School link: ${appUrl}${joinPath()}`,
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
