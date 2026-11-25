// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { paths, STANDARD_SUBJECTS } from '@sathiya/core';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { as, initEnv, type Role } from './setup';

let env: RulesTestEnvironment;

const school = (sid: string, status = 'active') => ({
  nameEn: `School ${sid}`,
  district: 'Kurunegala',
  city: 'Siripura',
  grades: [6],
  staffPrefix: 'SCC',
  colors: { primary: '#7A1F3D', second: '#D9A441' },
  type: 'government',
  censusNo: '12345',
  status,
  termsVersion: '1',
  acceptedTerms: { version: '1', at: 1, uid: 'u-admin' },
  activeYearId: 'y1',
  createdAt: 1,
});

const slotLock = (sid: string, yid: string, key: string) => `${paths.years(sid)}/${yid}/slotLocks/${key}`;

const seed: Record<string, Record<string, unknown>> = {
  [paths.school('s1')]: school('s1'),
  [paths.school('s2')]: school('s2'),
  [paths.school('sd')]: school('sd', 'disabled'),
  [paths.directory('s1')]: { nameEn: 'School s1', district: 'Kurunegala', city: 'Siripura', status: 'active' },
  [`${paths.teachers('s1')}/t1`]: { staffId: 'SCC001', name: 'T One', uid: 'u-teacher', subjectIds: [], grades: [6], maxPerDay: 6, isPrimary: false },
  [`${paths.teachers('s1')}/t2`]: { staffId: 'SCC002', name: 'T Two', subjectIds: [], grades: [6], maxPerDay: 6, isPrimary: false },
  [`${paths.teachers('s2')}/t9`]: { staffId: 'OTH001', name: 'T Nine', uid: 'u-other-t' },
  [`${paths.teachers('sd')}/td`]: { staffId: 'DIS001', name: 'T D' },
  [`${paths.subjects('s1')}/sub1`]: { nameEn: 'Maths', short: 'MAT', color: '#000000' },
  [`${paths.subjects('sd')}/sub1`]: { nameEn: 'Maths', short: 'MAT', color: '#000000' },
  [`${paths.templates('s1')}/p1`]: { name: 'Default', isDefault: true, mode: 'same', rows: [] },
  [`${paths.grades('s1')}/g1`]: { number: 6, plan: [] },
  [`${paths.classes('s1')}/c1`]: { gradeId: 'g1', name: '6A', templateId: 'p1' },
  [`${paths.subjects('s2')}/sub9`]: { nameEn: 'Art', short: 'ART', color: '#000000' },
  [`${paths.members('s1')}/u-admin`]: { uid: 'u-admin', role: 'admin', email: 'a@x.lk' },
  [`${paths.members('s1')}/u-teacher`]: { uid: 'u-teacher', role: 'teacher', teacherId: 't1' },
  [`${paths.invites('s1')}/b@x.lk`]: { email: 'b@x.lk', invitedBy: 'u-admin', createdAt: 1 },
  [`${paths.years('s1')}/y1`]: { label: '2026', status: 'published', publishedAt: 1 },
  [`${paths.years('s1')}/y2`]: { label: '2027', status: 'draft' },
  [`${paths.years('s2')}/y1`]: { label: '2026', status: 'published', publishedAt: 1 },
  [`${paths.years('sd')}/y1`]: { label: '2026', status: 'draft' },
  [`${paths.members('sd')}/u-dis`]: { uid: 'u-dis', role: 'admin', email: 'd@x.lk' },
  [`${paths.members('sd')}/u-dis-t`]: { uid: 'u-dis-t', role: 'teacher', teacherId: 'td' },
  [`${paths.invites('sd')}/e@x.lk`]: { email: 'e@x.lk', invitedBy: 'u-dis', createdAt: 1 },
  [`${paths.templates('sd')}/p1`]: { name: 'Default', isDefault: true, mode: 'same', rows: [] },
  [`${paths.grades('sd')}/g1`]: { number: 6, plan: [] },
  [`${paths.classes('sd')}/c1`]: { gradeId: 'g1', name: '6A', templateId: 'p1' },
  [`${paths.entries('sd', 'y1')}/e1`]: { day: 0, period: 1, classIds: ['c1'], lessons: [], teacherIds: ['td'] },
  [paths.publishedClass('sd', 'y1', 'c1')]: { cells: [] },
  [paths.publishedTeacher('sd', 'y1', 'td')]: { cells: [] },
  [`${paths.entries('s1', 'y1')}/e1`]: { day: 0, period: 1, classIds: ['c1'], lessons: [], teacherIds: ['t1'] },
  [slotLock('s1', 'y1', '0_t_t1')]: { updatedAt: 1, entryId: 'e1' },
  [paths.publishedClass('s1', 'y1', 'c1')]: { cells: [] },
  [paths.publishedTeacher('s1', 'y1', 't1')]: { cells: [] },
  [paths.publishedTeacher('s1', 'y1', 't2')]: { cells: [] },
  [paths.publishedClass('s2', 'y1', 'c9')]: { cells: [] },
  [`${paths.years('s1')}/y1/reliefDays/2026-11-24`]: { date: '2026-11-24', slots: [] },
  [`${paths.years('s2')}/y1/reliefDays/2026-11-24`]: { date: '2026-11-24', slots: [] },
  [`${paths.years('s1')}/y1/reliefMeta/stats`]: { count: 1 },
  [`${paths.years('s1')}/y1/reliefMeta/notified_2026-11-24`]: { sent: [] },
  [paths.user('u-admin')]: { lang: 'en', schoolId: 's1' },
  'censusIndex/12345': { schoolId: 's1' },
  'rateLimits/register-uid_2026-11-21_u-admin': { scope: 'register-uid', day: '2026-11-21', count: 1 },
  'mail/m1': { to: ['a@example.com'], message: { subject: 's', html: 'h', text: 't' } },
  'reports/r1': { schoolId: 's1', reason: 'fake', status: 'open', createdAt: 1 },
  [paths.user('u-teacher')]: { lang: 'si' },
  [paths.platform.config]: { maintenance: false },
  [paths.platform.terms('1')]: { body: 'terms' },
};

beforeAll(async () => {
  env = await initEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await Promise.all(Object.entries(seed).map(([p, v]) => d.doc(p).set(v)));
  });
});

const db = (r: Role) => as(env, r).firestore();
const read = (r: Role, p: string) => db(r).doc(p).get();
const list = (r: Role, p: string) => db(r).collection(p).get();
const set = (r: Role, p: string, v: Record<string, unknown>) => db(r).doc(p).set(v);
const update = (r: Role, p: string, v: Record<string, unknown>) => db(r).doc(p).update(v);
const del = (r: Role, p: string) => db(r).doc(p).delete();

type Case = [Role, string];
const allow = (cases: Case[], fn: (r: Role, p: string) => Promise<unknown>) =>
  it.each(cases)('allows %s on %s', async (r, p) => {
    await assertSucceeds(fn(r, p));
  });
const deny = (cases: Case[], fn: (r: Role, p: string) => Promise<unknown>) =>
  it.each(cases)('denies %s on %s', async (r, p) => {
    await assertFails(fn(r, p));
  });

describe('schoolDirectory', () => {
  const p = paths.directory('s1');
  describe('read', () => {
    allow([['anon', p], ['noClaims', p], ['teacher', p], ['otherAdmin', p]], read);
  });
  describe('write', () => {
    deny([['admin', p], ['super', p], ['anon', p]], (r, q) => set(r, q, { nameEn: 'x', district: 'x', status: 'active' }));
    deny([['admin', paths.directory('new')], ['noClaims', paths.directory('new')]], (r, q) => set(r, q, { nameEn: 'x' }));
    deny([['admin', p], ['super', p]], (r, q) => del(r, q));
  });
});

describe('schools/{sid} doc', () => {
  const s1 = paths.school('s1');
  describe('read', () => {
    allow([['admin', s1], ['adminTid', s1], ['teacher', s1], ['super', s1], ['super', paths.school('s2')], ['disabledAdmin', paths.school('sd')]], read);
    deny([['otherAdmin', s1], ['otherTeacher', s1], ['teacher', paths.school('s2')], ['noClaims', s1], ['anon', s1]], read);
  });

  describe('census number is functions only', () => {
    deny([['super', s1], ['teacher', s1]], (r, p) => update(r, p, { censusNo: '54321' }));
    deny([['super', s1]], (r, p) => update(r, p, { releasedCensusNo: '12345', censusReleasedAt: 2, censusReleasedBy: 'u-super' }));
  });

  describe('update', () => {
    it.each([
      ['nameEn', 'New name'],
      ['nameSi', 'නම'],
      ['logoUrl', 'https://x/logo.png'],
      ['colors', { primary: '#000000', second: '#FFFFFF' }],
      ['city', 'Kurunegala'],
      ['address', '12 Temple Road'],
      ['phone', '037 222 3344'],
    ])('allows admin to change %s', async (k, v) => {
      await assertSucceeds(update('admin', s1, { [k]: v }));
    });

    it('allows adminTid to change nameEn', async () => {
      await assertSucceeds(update('adminTid', s1, { nameEn: 'x' }));
    });

    it.each([
      ['status', 'disabled'],
      ['activeYearId', 'y2'],
      ['termsVersion', '9'],
      ['acceptedTerms', { version: '9', at: 2, uid: 'u-admin' }],
      ['createdAt', 2],
      ['type', 'private'],
      ['censusNo', '54321'],
      ['releasedCensusNo', '12345'],
      ['censusReleasedAt', 2],
      ['censusReleasedBy', 'u-admin'],
      ['somethingElse', 1],
    ])('denies admin changing %s', async (k, v) => {
      await assertFails(update('admin', s1, { [k]: v }));
    });

    it.each([
      ['city', ''],
      ['city', '   '],
      ['city', 'x'.repeat(81)],
      ['city', 5],
      ['address', 'a'.repeat(201)],
      ['address', 5],
      ['phone', '1'.repeat(31)],
      ['phone', 37],
    ])('denies admin setting invalid %s %j', async (k, v) => {
      await assertFails(update('admin', s1, { [k]: v }));
    });

    it('allows max-length city/address/phone and removing address/phone', async () => {
      await assertSucceeds(update('admin', s1, { city: 'x'.repeat(80), address: 'a'.repeat(200), phone: '1'.repeat(30) }));
      await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(s1).update({ address: 'a', phone: '1' }));
      await assertSucceeds(set('admin', s1, { ...school('s1') }));
    });

    it('denies admin removing type or censusNo', async () => {
      const { type: _t, ...noType } = school('s1');
      const { censusNo: _c, ...noCensus } = school('s1');
      await assertFails(set('admin', s1, noType));
      await assertFails(set('admin', s1, noCensus));
    });

    it('denies admin removing city', async () => {
      const { city: _, ...noCity } = school('s1');
      await assertFails(set('admin', s1, noCity));
    });

    deny(
      [['teacher', s1], ['super', s1], ['otherAdmin', s1], ['noClaims', s1], ['anon', s1], ['disabledAdmin', paths.school('sd')]],
      (r, p) => update(r, p, { nameEn: 'x' }),
    );
  });

  describe('create / delete', () => {
    it('denies admin creating a school doc', async () => {
      await assertFails(as(env, 'anon').firestore().doc(paths.school('new')).set(school('new')));
      await assertFails(env.authenticatedContext('u-x', { schools: { new: { r: 'a' } } }).firestore().doc(paths.school('new')).set(school('new')));
      await assertFails(set('noClaims', paths.school('new'), school('new')));
      await assertFails(set('super', paths.school('new'), school('new')));
    });
    deny([['admin', s1], ['super', s1]], del);
  });
});

describe('teachers', () => {
  const t1 = `${paths.teachers('s1')}/t1`;
  const t2 = `${paths.teachers('s1')}/t2`;
  describe('read', () => {
    allow([['admin', t1], ['admin', t2], ['adminTid', t1], ['teacher', t1], ['super', t1], ['super', `${paths.teachers('s2')}/t9`]], read);
    deny([['teacher', t2], ['otherAdmin', t1], ['otherTeacher', t1], ['teacher', `${paths.teachers('s2')}/t9`], ['noClaims', t1], ['anon', t1]], read);
    allow([['admin', paths.teachers('s1')]], list);
    deny([['teacher', paths.teachers('s1')], ['otherAdmin', paths.teachers('s1')]], list);
  });

  describe('update', () => {
    allow([['admin', t1], ['admin', t2]], (r, p) => update(r, p, { name: 'Renamed', maxPerDay: 5 }));
    it('denies admin changing uid or staffId', async () => {
      await assertFails(update('admin', t1, { uid: 'someone-else' }));
      await assertFails(update('admin', t2, { uid: 'u-new' }));
      await assertFails(update('admin', t1, { staffId: 'SCC099' }));
    });
    it('lets admin set a known title and refuses any other', async () => {
      await assertSucceeds(update('admin', t1, { title: 'Mrs', name: 'N. Perera' }));
      await assertSucceeds(update('admin', t2, { title: 'Ven.' }));
      await assertFails(update('admin', t1, { title: 'King' }));
      await assertFails(update('admin', t1, { title: 3 }));
      await assertFails(update('admin', t1, { title: 'Thero' }));
    });

    it('leaves inviteExpiresAt to the link callables', async () => {
      await assertFails(update('admin', t1, { inviteExpiresAt: 1 }));
    });
    it('leaves lastLoginAt to the recordSignIn callable', async () => {
      await assertFails(update('admin', t1, { lastLoginAt: 1 }));
      await assertFails(update('teacher', t1, { lastLoginAt: 1 }));
    });
    deny(
      [['teacher', t1], ['super', t1], ['otherAdmin', t1], ['anon', t1], ['disabledAdmin', `${paths.teachers('sd')}/td`]],
      (r, p) => update(r, p, { name: 'x' }),
    );
  });

  describe('create / delete', () => {
    deny([['admin', `${paths.teachers('s1')}/t3`]], (r, p) => set(r, p, { staffId: 'SCC003', name: 'New' }));
    deny([['admin', t1], ['super', t1]], del);
  });
});

describe.each(['subjects', 'periodTemplates', 'classes', 'grades'] as const)('setup collection %s', (coll) => {
  const col = (sid: string) => `${paths.school(sid)}/${coll}`;
  const existing = { subjects: 'sub1', periodTemplates: 'p1', classes: 'c1', grades: 'g1' }[coll];
  const d = `${col('s1')}/${existing}`;
  const fresh = `${col('s1')}/new1`;

  describe('read', () => {
    allow([['admin', d], ['adminTid', d], ['super', d]], read);
    deny([['teacher', d], ['otherAdmin', d], ['otherTeacher', d], ['noClaims', d], ['anon', d]], read);
  });

  describe('write', () => {
    allow([['admin', fresh], ['adminTid', fresh]], (r, p) => set(r, p, { name: 'x' }));
    allow([['admin', d]], (r, p) => update(r, p, { name: 'changed' }));
    deny(
      [['teacher', fresh], ['super', fresh], ['otherAdmin', fresh], ['noClaims', fresh], ['anon', fresh], ['disabledAdmin', `${col('sd')}/new1`]],
      (r, p) => set(r, p, { name: 'x' }),
    );
    deny([['teacher', d], ['super', d]], (r, p) => update(r, p, { name: 'changed' }));
    deny([['admin', d], ['adminTid', d], ['super', d], ['teacher', d], ['otherAdmin', d]], del);
  });
});

describe('disabled school', () => {
  const sd = paths.school('sd');
  const scoped = [
    `${paths.teachers('sd')}/td`,
    `${paths.subjects('sd')}/sub1`,
    `${paths.templates('sd')}/p1`,
    `${paths.grades('sd')}/g1`,
    `${paths.classes('sd')}/c1`,
    `${paths.members('sd')}/u-dis`,
    `${paths.members('sd')}/u-dis-t`,
    `${paths.invites('sd')}/e@x.lk`,
    `${paths.years('sd')}/y1`,
    `${paths.entries('sd', 'y1')}/e1`,
    paths.publishedClass('sd', 'y1', 'c1'),
    paths.publishedTeacher('sd', 'y1', 'td'),
  ];
  const lists = [
    paths.teachers('sd'),
    paths.subjects('sd'),
    paths.templates('sd'),
    paths.grades('sd'),
    paths.classes('sd'),
    paths.members('sd'),
    paths.invites('sd'),
    paths.years('sd'),
    paths.entries('sd', 'y1'),
    paths.publishedClasses('sd', 'y1'),
    paths.publishedTeachers('sd', 'y1'),
  ];

  it('denies every admin write', async () => {
    await assertFails(update('disabledAdmin', `${paths.subjects('sd')}/sub1`, { short: 'X' }));
    await assertFails(set('disabledAdmin', `${paths.grades('sd')}/g1`, { number: 6, plan: [] }));
    await assertFails(set('disabledAdmin', `${paths.years('sd')}/y2`, { label: '2027', status: 'draft' }));
    await assertFails(update('disabledAdmin', `${paths.years('sd')}/y1`, { label: 'x' }));
    await assertFails(update('disabledAdmin', sd, { nameEn: 'x' }));
    await assertFails(update('disabledAdmin', `${paths.teachers('sd')}/td`, { name: 'x' }));
  });
  it('denies every teacher write', async () => {
    await assertFails(update('disabledTeacher', `${paths.teachers('sd')}/td`, { name: 'x' }));
    await assertFails(update('disabledTeacher', `${paths.years('sd')}/y1`, { label: 'x' }));
    await assertFails(update('disabledTeacher', sd, { nameEn: 'x' }));
  });
  allow([['disabledAdmin', sd], ['disabledTeacher', sd], ['super', sd]], read);
  deny(scoped.map((p): Case => ['disabledAdmin', p]), read);
  deny(scoped.map((p): Case => ['disabledTeacher', p]), read);
  deny(lists.map((p): Case => ['disabledAdmin', p]), list);
  deny(lists.map((p): Case => ['disabledTeacher', p]), list);
  allow(scoped.map((p): Case => ['super', p]), read);
  allow(lists.map((p): Case => ['super', p]), list);
});

describe('members', () => {
  const ma = `${paths.members('s1')}/u-admin`;
  const mt = `${paths.members('s1')}/u-teacher`;
  describe('read', () => {
    allow([['admin', ma], ['admin', mt], ['adminTid', ma], ['super', ma], ['teacher', mt]], read);
    deny([['teacher', ma], ['otherAdmin', ma], ['noClaims', ma], ['anon', ma]], read);
    allow([['admin', paths.members('s1')]], list);
    deny([['teacher', paths.members('s1')]], list);
  });
  describe('write', () => {
    deny([['admin', `${paths.members('s1')}/u-x`], ['super', `${paths.members('s1')}/u-x`], ['noClaims', `${paths.members('s1')}/u-new`]], (r, p) =>
      set(r, p, { uid: 'u-x', role: 'admin' }),
    );
    deny([['admin', mt], ['teacher', mt]], (r, p) => update(r, p, { role: 'admin' }));
    deny([['admin', mt]], del);
  });
});

describe('multi-school claims', () => {
  const t = (sid: string, id: string) => `${paths.teachers(sid)}/${id}`;
  it('admin of s1 is denied on s2', async () => {
    await assertFails(read('admin', paths.school('s2')));
    await assertFails(read('admin', `${paths.subjects('s2')}/sub9`));
    await assertFails(set('admin', `${paths.subjects('s2')}/new`, { nameEn: 'x', short: 'X', color: '#000000' }));
    await assertFails(update('admin', paths.school('s2'), { nameEn: 'x' }));
  });
  it('teacher in two schools reads only own teacher doc in each', async () => {
    await assertSucceeds(read('multiTeacher', t('s1', 't1')));
    await assertSucceeds(read('multiTeacher', t('s2', 't9')));
    await assertFails(read('multiTeacher', t('s1', 't2')));
    await assertFails(read('multiTeacher', t('s2', 't1')));
    await assertFails(read('multiTeacher', paths.school('sd')));
  });
  it('admin of s1 and teacher of s2 gets admin powers only in s1', async () => {
    await assertSucceeds(read('adminS1TeacherS2', `${paths.subjects('s1')}/sub1`));
    await assertSucceeds(set('adminS1TeacherS2', `${paths.subjects('s1')}/new`, { nameEn: 'x', short: 'X', color: '#000000' }));
    await assertFails(read('adminS1TeacherS2', `${paths.subjects('s2')}/sub9`));
    await assertFails(set('adminS1TeacherS2', `${paths.subjects('s2')}/new`, { nameEn: 'x', short: 'X', color: '#000000' }));
    await assertSucceeds(read('adminS1TeacherS2', t('s2', 't9')));
    await assertFails(read('adminS1TeacherS2', t('s2', 't1')));
    await assertSucceeds(read('adminS1TeacherS2', t('s1', 't2')));
  });
  it('admin-teacher keeps teacher reads in own school', async () => {
    await assertSucceeds(read('adminTid', paths.publishedTeacher('s1', 'y1', 't2')));
    await assertSucceeds(read('adminTid', paths.publishedClass('s1', 'y1', 'c1')));
  });
  it('old flat claims grant nothing', async () => {
    const ctx = env.authenticatedContext('u-old', { sid: 's1', role: 'admin', tid: 't1' }).firestore();
    await assertFails(ctx.doc(paths.school('s1')).get());
    await assertFails(ctx.doc(`${paths.teachers('s1')}/t1`).get());
  });
});

describe('joinLink (admins read, functions write)', () => {
  const p = paths.joinLink('s1');
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(p).set({ hash: 'h', token: 'tok', createdAt: 1 }));
  });
  allow([['admin', p], ['adminTid', p], ['super', p]], read);
  deny(
    [['teacher', p], ['otherAdmin', p], ['adminS1TeacherS2', paths.joinLink('s2')], ['disabledAdmin', paths.joinLink('sd')], ['noClaims', p], ['anon', p]],
    read,
  );
  deny([['admin', `${paths.school('s1')}/private/other`]], read);
  deny([['admin', p], ['super', p]], (r, q) => set(r, q, { hash: 'x' }));
  deny([['admin', p]], del);
  deny([['admin', `${paths.school('s1')}/private`]], list);
});

describe('teacherLinks (functions only)', () => {
  const p = `${paths.teacherLinks()}/h1`;
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(p).set({ schoolId: 's1', teacherId: 't1' }));
  });
  deny([['admin', p], ['adminTid', p], ['teacher', p], ['super', p], ['otherAdmin', p], ['noClaims', p], ['anon', p]], read);
  deny([['admin', p], ['super', p], ['teacher', p]], (r, q) => set(r, q, { schoolId: 's1' }));
  deny([['admin', p]], del);
  deny([['admin', paths.teacherLinks()]], list);
});

describe('joinRequests', () => {
  const p = `${paths.joinRequests('s1')}/u-req`;
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(p).set({ uid: 'u-req', email: 'r@x.lk', createdAt: 1 }));
  });
  describe('read', () => {
    allow([['admin', p], ['adminTid', p], ['super', p]], read);
    allow([['admin', paths.joinRequests('s1')]], list);
    deny([['teacher', p], ['otherAdmin', p], ['adminS1TeacherS2', `${paths.joinRequests('s2')}/u-req`], ['noClaims', p], ['anon', p]], read);
  });
  describe('own request', () => {
    const own = `${paths.joinRequests('s1')}/u-new`;
    beforeEach(async () => {
      await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(own).set({ uid: 'u-new', email: 'n@x.lk', status: 'rejected', createdAt: 1 }));
    });
    allow([['noClaims', own]], read);
    deny([['noClaims', p], ['teacher', own], ['anon', own]], read);
    deny([['noClaims', paths.joinRequests('s1')]], list);
    deny([['noClaims', own]], (r, q) => update(r, q, { status: 'pending' }));
  });
  describe('write (functions only)', () => {
    const fresh = `${paths.joinRequests('s1')}/u-new`;
    deny([['admin', fresh], ['noClaims', fresh], ['teacher', fresh], ['super', fresh], ['anon', fresh]], (r, q) => set(r, q, { uid: 'u-new', email: 'n@x.lk' }));
    deny([['admin', p]], (r, q) => update(r, q, { email: 'z@x.lk' }));
    deny([['admin', p]], del);
  });
});

describe('invites', () => {
  const inv = `${paths.invites('s1')}/b@x.lk`;
  allow([['admin', inv], ['super', inv]], read);
  deny([['teacher', inv], ['otherAdmin', inv], ['noClaims', inv], ['anon', inv]], read);
  deny([['admin', `${paths.invites('s1')}/c@x.lk`], ['super', `${paths.invites('s1')}/c@x.lk`]], (r, p) => set(r, p, { email: 'c@x.lk' }));
  deny([['admin', inv]], del);
});

describe('years', () => {
  const y1 = `${paths.years('s1')}/y1`;
  const y2 = `${paths.years('s1')}/y2`;
  const y3 = `${paths.years('s1')}/y3`;
  describe('read', () => {
    allow([['admin', y1], ['adminTid', y2], ['teacher', y1], ['teacher', y2], ['super', y1]], read);
    deny([['otherAdmin', y1], ['otherTeacher', y1], ['teacher', `${paths.years('s2')}/y1`], ['noClaims', y1], ['anon', y1]], read);
    allow([['teacher', paths.years('s1')]], list);
  });
  describe('create', () => {
    allow([['admin', y3]], (r, p) => set(r, p, { label: '2028', status: 'draft' }));
    it('denies admin creating a published year or one with publishedAt', async () => {
      await assertFails(set('admin', y3, { label: '2028', status: 'published' }));
      await assertFails(set('admin', y3, { label: '2028', status: 'draft', publishedAt: 1 }));
      await assertFails(set('admin', y3, { label: '2028' }));
    });
    it('denies admin creating a year without a non-empty string label', async () => {
      await assertFails(set('admin', y3, { status: 'draft' }));
      await assertFails(set('admin', y3, { label: '', status: 'draft' }));
      await assertFails(set('admin', y3, { label: '  ', status: 'draft' }));
      await assertFails(set('admin', y3, { label: 2028, status: 'draft' }));
    });
    it('denies admin creating a year whose label is not a 4-digit year', async () => {
      for (const label of ['abc', '28', '20288', ' 2028', '2028 ', '1999', '2101', '2028a']) {
        await assertFails(set('admin', y3, { label, status: 'draft' }));
      }
      await assertSucceeds(set('admin', y3, { label: '2000', status: 'draft' }));
    });
    deny([['teacher', y3], ['super', y3], ['otherAdmin', y3], ['anon', y3]], (r, p) => set(r, p, { label: '2028', status: 'draft' }));
  });
  describe('update', () => {
    allow([['admin', y2], ['admin', y1]], (r, p) => update(r, p, { label: '2029' }));
    it('denies admin changing status or publishedAt', async () => {
      await assertFails(update('admin', y2, { status: 'published' }));
      await assertFails(update('admin', y1, { status: 'draft' }));
      await assertFails(update('admin', y1, { publishedAt: 2 }));
      await assertFails(update('admin', y2, { publishedAt: 2 }));
    });
    it('denies admin writing applyingUntil', async () => {
      await assertFails(update('admin', y2, { applyingUntil: 1 }));
      await assertFails(set('admin', y3, { label: '2028', status: 'draft', applyingUntil: 1 }));
    });
    it('denies admin blanking or removing the label', async () => {
      await assertFails(update('admin', y2, { label: ' ' }));
      await assertFails(update('admin', y2, { label: 7 }));
      await assertFails(set('admin', y2, { status: 'draft' }));
    });
    it('denies admin renaming a year to anything but a 4-digit year', async () => {
      for (const label of ['renamed', '28', '1999', '2101', ' 2028']) {
        await assertFails(update('admin', y2, { label }));
      }
    });
    deny([['teacher', y2], ['super', y2]], (r, p) => update(r, p, { label: 'x' }));
  });
  deny([['admin', y2], ['super', y2]], del);
});

describe('entries (draft)', () => {
  const e1 = `${paths.entries('s1', 'y1')}/e1`;
  const e2 = `${paths.entries('s1', 'y1')}/e2`;
  const entry = { day: 0, period: 2, classIds: ['c1'], lessons: [], teacherIds: [] };
  describe('read', () => {
    allow([['admin', e1], ['adminTid', e1], ['super', e1]], read);
    deny([['teacher', e1], ['otherAdmin', e1], ['otherTeacher', e1], ['noClaims', e1], ['anon', e1]], read);
    allow([['admin', paths.entries('s1', 'y1')]], list);
    deny([['teacher', paths.entries('s1', 'y1')]], list);
  });
  describe('write (functions only)', () => {
    deny([['admin', e2], ['adminTid', e2], ['super', e2], ['teacher', e2]], (r, p) => set(r, p, entry));
    deny([['admin', e1], ['super', e1]], (r, p) => update(r, p, { period: 3 }));
    deny([['admin', e1], ['super', e1]], del);
  });
});

describe('slotLocks (functions only)', () => {
  const l = slotLock('s1', 'y1', '0_t_t1');
  deny([['admin', l], ['super', l], ['teacher', l]], read);
  deny([['admin', l], ['super', l]], (r, p) => set(r, p, { updatedAt: 2 }));
  deny([['admin', l]], del);
});

describe('imports (functions only)', () => {
  const m = `${paths.imports('s1')}/x`;
  deny([['admin', m], ['super', m], ['teacher', m]], read);
  deny([['admin', paths.imports('s1')]], list);
  deny([['admin', m], ['super', m]], (r, p) => set(r, p, { createdAt: 1 }));
  deny([['admin', m]], del);
});

describe('publishedClasses', () => {
  const pc = paths.publishedClass('s1', 'y1', 'c1');
  describe('read', () => {
    allow([['admin', pc], ['adminTid', pc], ['teacher', pc], ['super', pc]], read);
    deny([['otherAdmin', pc], ['otherTeacher', pc], ['teacher', paths.publishedClass('s2', 'y1', 'c9')], ['noClaims', pc], ['anon', pc]], read);
    allow([['teacher', paths.publishedClasses('s1', 'y1')]], list);
    deny([['teacher', paths.publishedClasses('s2', 'y1')]], list);
  });
  describe('write (functions only)', () => {
    deny([['admin', pc], ['teacher', pc], ['super', pc]], (r, p) => set(r, p, { cells: [1] }));
    deny([['admin', pc]], del);
  });
});

describe('publishedTeachers', () => {
  const own = paths.publishedTeacher('s1', 'y1', 't1');
  const t2 = paths.publishedTeacher('s1', 'y1', 't2');
  describe('read', () => {
    allow([['teacher', own], ['admin', own], ['admin', t2], ['adminTid', t2], ['adminTid', own], ['super', own]], read);
    deny([['teacher', t2], ['otherAdmin', own], ['otherTeacher', own], ['noClaims', own], ['anon', own]], read);
    allow([['admin', paths.publishedTeachers('s1', 'y1')]], list);
    deny([['teacher', paths.publishedTeachers('s1', 'y1')]], list);
  });
  describe('write (functions only)', () => {
    deny([['admin', own], ['teacher', own], ['super', own]], (r, p) => set(r, p, { cells: [1] }));
    deny([['admin', own]], del);
  });
});

describe('reliefDays', () => {
  const rd = `${paths.years('s1')}/y1/reliefDays/2026-11-24`;
  describe('read', () => {
    allow([['admin', rd], ['adminTid', rd], ['teacher', rd], ['super', rd]], read);
    deny([['otherAdmin', rd], ['otherTeacher', rd], ['teacher', `${paths.years('s2')}/y1/reliefDays/2026-11-24`], ['noClaims', rd], ['anon', rd]], read);
  });
  describe('write (functions only)', () => {
    deny([['admin', rd], ['teacher', rd], ['super', rd]], (r, p) => set(r, p, { slots: [1] }));
    deny([['admin', rd]], del);
  });
});

describe('reliefMeta (admins read, functions write)', () => {
  const stats = `${paths.years('s1')}/y1/reliefMeta/stats`;
  const notified = `${paths.years('s1')}/y1/reliefMeta/notified_2026-11-24`;
  describe('read', () => {
    allow([['admin', stats], ['admin', notified], ['super', notified]], read);
    deny([['teacher', stats], ['teacher', notified], ['otherAdmin', notified], ['noClaims', notified], ['anon', notified]], read);
  });
  describe('write', () => {
    deny([['admin', stats], ['super', stats], ['teacher', stats]], (r, p) => set(r, p, { count: 2 }));
    deny([['admin', notified]], del);
  });
});

describe('teacher of another school', () => {
  it('cannot read anything of s1', async () => {
    for (const p of [
      paths.school('s1'),
      `${paths.years('s1')}/y1`,
      paths.publishedClass('s1', 'y1', 'c1'),
      paths.publishedTeacher('s1', 'y1', 't1'),
      `${paths.members('s1')}/u-teacher`,
    ]) {
      await assertFails(read('otherTeacher', p));
    }
  });
});

describe('unknown paths', () => {
  deny([['admin', `${paths.school('s1')}/secrets/x`], ['super', `${paths.school('s1')}/secrets/x`], ['admin', 'other/x']], read);
  deny([['admin', `${paths.school('s1')}/secrets/x`], ['super', 'other/x']], (r, p) => set(r, p, { a: 1 }));
});

describe('default period template', () => {
  const p1 = `${paths.templates('s1')}/p1`;
  it('denies admin clearing or removing isDefault on the default template', async () => {
    await assertFails(update('admin', p1, { isDefault: false }));
    const { isDefault: _, ...rest } = { name: 'Default', isDefault: true, mode: 'same', rows: [] };
    await assertFails(set('admin', p1, rest));
  });
  it('allows other edits of the default template', async () => {
    await assertSucceeds(update('admin', p1, { name: 'Main', isDefault: true }));
    await assertSucceeds(update('admin', p1, { rows: [] }));
  });
  it('denies admin changing rows, days or mode directly, since the callable owns schedule edits', async () => {
    await assertFails(update('admin', p1, { rows: [{ type: 'period', start: '07:30', end: '08:10' }] }));
    await assertFails(update('admin', p1, { days: { 0: [] } }));
    await assertFails(update('admin', p1, { mode: 'perDay' }));
  });
});

describe('censusIndex (functions only)', () => {
  const c = 'censusIndex/12345';
  const n = 'censusIndex/99999';
  deny([['admin', c], ['super', c], ['noClaims', c], ['anon', c]], read);
  deny([['admin', 'censusIndex'], ['super', 'censusIndex']], list);
  deny([['noClaims', n], ['admin', n], ['super', n], ['anon', n]], (r, p) => set(r, p, { schoolId: 'x' }));
  deny([['admin', c], ['super', c], ['teacher', c]], del);
  deny([['teacher', c]], read);
  deny([['admin', c], ['super', c], ['teacher', c]], (r, p) => update(r, p, { schoolId: 'x' }));
});

describe('mail (functions only)', () => {
  const m = 'mail/m1';
  const n = 'mail/m2';
  deny([['admin', m], ['teacher', m], ['adminTid', m], ['super', m], ['otherAdmin', m], ['otherTeacher', m], ['disabledAdmin', m], ['noClaims', m], ['anon', m]], read);
  deny([['admin', 'mail'], ['teacher', 'mail'], ['super', 'mail'], ['anon', 'mail']], list);
  deny(
    [['admin', n], ['teacher', n], ['adminTid', n], ['super', n], ['otherAdmin', n], ['otherTeacher', n], ['disabledAdmin', n], ['noClaims', n], ['anon', n]],
    (r, p) => set(r, p, { to: ['a@example.com'], message: { subject: 's', html: 'h', text: 't' } }),
  );
  deny([['admin', m], ['teacher', m], ['super', m], ['anon', m]], (r, p) => update(r, p, { to: ['x@example.com'] }));
  deny([['admin', m], ['teacher', m], ['super', m], ['anon', m]], del);
});

describe('rateLimits (functions only)', () => {
  const k = 'rateLimits/register-uid_2026-11-21_u-admin';
  deny([['admin', k], ['super', k], ['noClaims', k], ['anon', k]], read);
  deny([['super', 'rateLimits'], ['anon', 'rateLimits']], list);
  deny([['admin', k], ['super', k], ['anon', k]], (r, p) => set(r, p, { count: 0 }));
  deny([['admin', k], ['super', k]], del);
});

describe('reports', () => {
  const r1 = 'reports/r1';
  allow([['super', r1]], read);
  allow([['super', 'reports']], list);
  deny([['admin', r1], ['teacher', r1], ['noClaims', r1], ['anon', r1]], read);
  deny([['admin', 'reports'], ['anon', 'reports']], list);
  it.each(['closed', 'open'])('allows super to set status %s with a note', async (status) => {
    await assertSucceeds(update('super', r1, { status, note: 'checked' }));
  });
  it('denies super invalid status, long note or other fields', async () => {
    await assertFails(update('super', r1, { status: 'resolved' }));
    await assertFails(update('super', r1, { status: 'dismissed' }));
    await assertFails(update('super', r1, { status: 'bogus' }));
    await assertFails(update('super', r1, { note: 'x'.repeat(1001) }));
    await assertFails(update('super', r1, { note: 5 }));
    await assertFails(update('super', r1, { reason: 'other' }));
    await assertFails(update('super', r1, { schoolId: 's2' }));
  });
  deny([['admin', r1], ['noClaims', r1], ['anon', r1]], (r, p) => update(r, p, { status: 'closed' }));
  const fresh = { schoolId: 's1', reason: 'fake', status: 'open', createdAt: 1 };
  deny([['anon', 'reports/new'], ['noClaims', 'reports/new'], ['admin', 'reports/new'], ['super', 'reports/new']], (r, p) => set(r, p, fresh));
  deny([['super', r1], ['admin', r1]], del);
});

describe('users/{uid}', () => {
  const ua = paths.user('u-admin');
  const un = paths.user('u-new');
  describe('read', () => {
    allow([['admin', ua], ['noClaims', un]], read);
    deny([['teacher', ua], ['super', ua], ['anon', ua]], read);
  });
  describe('write', () => {
    allow([['noClaims', un]], (r, p) => set(r, p, { lang: 'si' }));
    allow([['admin', ua]], (r, p) => update(r, p, { lang: 'si' }));
    allow([['admin', ua]], (r, p) => set(r, p, { lang: 'si', schoolId: 's1' }));
    it('denies other keys or values', async () => {
      await assertFails(set('noClaims', un, { lang: 'fr' }));
      await assertFails(set('noClaims', un, { lang: 'en', role: 'admin' }));
      await assertFails(set('noClaims', un, { role: 'admin' }));
      await assertFails(update('admin', ua, { super: true }));
      await assertFails(set('noClaims', un, { lang: 1 }));
    });
    it('keeps schoolId functions-only', async () => {
      await assertSucceeds(update('admin', ua, { lang: 'si' }));
      await assertFails(update('admin', ua, { schoolId: 's2' }));
      await assertFails(update('admin', ua, { lang: 'en', schoolId: 's2' }));
      await assertFails(set('admin', ua, { lang: 'en' }));
      await assertFails(set('noClaims', un, { lang: 'en', schoolId: 's1' }));
      await assertFails(set('noClaims', un, { schoolId: 's1' }));
    });
    deny([['teacher', ua], ['super', ua], ['anon', un]], (r, p) => set(r, p, { lang: 'en' }));
    deny([['admin', ua]], del);
  });
});

describe('load standard subjects', () => {
  it('admin can batch-add the standard list to a school', async () => {
    const fs = db('admin');
    const batch = fs.batch();
    for (const s of STANDARD_SUBJECTS) batch.set(fs.collection(paths.subjects('s1')).doc(), { ...s });
    await assertSucceeds(batch.commit());
  });
  it('a disabled school cannot', async () => {
    const fs = db('disabledAdmin');
    const batch = fs.batch();
    batch.set(fs.collection(paths.subjects('sd')).doc(), { ...STANDARD_SUBJECTS[0] });
    await assertFails(batch.commit());
  });
});

describe('platform', () => {
  const cfg = paths.platform.config;
  const terms = paths.platform.terms('1');
  allow([['noClaims', cfg], ['teacher', terms], ['admin', paths.platform.defaultSubjects], ['super', cfg]], read);
  deny([['anon', cfg], ['anon', terms]], read);
  allow([['super', cfg], ['super', paths.platform.terms('2')]], (r, p) => set(r, p, { a: 1 }));
  deny([['admin', cfg], ['noClaims', terms], ['teacher', cfg], ['anon', cfg]], (r, p) => set(r, p, { a: 1 }));
  allow([['super', terms]], del);
  deny([['admin', terms]], del);
});
