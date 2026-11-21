// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { paths } from '@sathiya/core';
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
  [`${paths.entries('s1', 'y1')}/e1`]: { day: 0, period: 1, classIds: ['c1'], lessons: [], teacherIds: ['t1'] },
  [slotLock('s1', 'y1', '0_t_t1')]: { updatedAt: 1, entryId: 'e1' },
  [paths.publishedClass('s1', 'y1', 'c1')]: { cells: [] },
  [paths.publishedTeacher('s1', 'y1', 't1')]: { cells: [] },
  [paths.publishedTeacher('s1', 'y1', 't2')]: { cells: [] },
  [paths.publishedClass('s2', 'y1', 'c9')]: { cells: [] },
  [paths.user('u-admin')]: { lang: 'en', schoolId: 's1' },
  'censusIndex/12345': { schoolId: 's1' },
  'rateLimits/register-uid_2026-11-21_u-admin': { scope: 'register-uid', day: '2026-11-21', count: 1 },
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
      await assertFails(env.authenticatedContext('u-x', { sid: 'new', role: 'admin' }).firestore().doc(paths.school('new')).set(school('new')));
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
    if (coll === 'grades') {
      allow([['admin', d]], del);
      deny([['teacher', d], ['super', d], ['otherAdmin', d]], del);
    } else {
      deny([['admin', d], ['super', d]], del);
    }
  });
});

describe('disabled school', () => {
  it('denies every admin write', async () => {
    await assertFails(update('disabledAdmin', `${paths.subjects('sd')}/sub1`, { short: 'X' }));
    await assertFails(set('disabledAdmin', `${paths.grades('sd')}/g1`, { number: 6, plan: [] }));
    await assertFails(set('disabledAdmin', `${paths.years('sd')}/y2`, { label: '2027', status: 'draft' }));
    await assertFails(update('disabledAdmin', `${paths.years('sd')}/y1`, { label: 'x' }));
  });
  it('still allows reads', async () => {
    await assertSucceeds(read('disabledAdmin', `${paths.subjects('sd')}/sub1`));
  });
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
    deny([['teacher', y3], ['super', y3], ['otherAdmin', y3], ['anon', y3]], (r, p) => set(r, p, { label: '2028', status: 'draft' }));
  });
  describe('update', () => {
    allow([['admin', y2], ['admin', y1]], (r, p) => update(r, p, { label: 'renamed' }));
    it('denies admin changing status or publishedAt', async () => {
      await assertFails(update('admin', y2, { status: 'published' }));
      await assertFails(update('admin', y1, { status: 'draft' }));
      await assertFails(update('admin', y1, { publishedAt: 2 }));
      await assertFails(update('admin', y2, { publishedAt: 2 }));
    });
    it('denies admin blanking or removing the label', async () => {
      await assertFails(update('admin', y2, { label: ' ' }));
      await assertFails(update('admin', y2, { label: 7 }));
      await assertFails(set('admin', y2, { status: 'draft' }));
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
});

describe('censusIndex (functions only)', () => {
  const c = 'censusIndex/12345';
  const n = 'censusIndex/99999';
  deny([['admin', c], ['super', c], ['noClaims', c], ['anon', c]], read);
  deny([['admin', 'censusIndex'], ['super', 'censusIndex']], list);
  deny([['noClaims', n], ['admin', n], ['super', n], ['anon', n]], (r, p) => set(r, p, { schoolId: 'x' }));
  deny([['admin', c], ['super', c]], del);
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
  it.each(['resolved', 'dismissed', 'open'])('allows super to set status %s with a note', async (status) => {
    await assertSucceeds(update('super', r1, { status, note: 'checked' }));
  });
  it('denies super invalid status, long note or other fields', async () => {
    await assertFails(update('super', r1, { status: 'closed' }));
    await assertFails(update('super', r1, { note: 'x'.repeat(1001) }));
    await assertFails(update('super', r1, { note: 5 }));
    await assertFails(update('super', r1, { reason: 'other' }));
    await assertFails(update('super', r1, { schoolId: 's2' }));
  });
  deny([['admin', r1], ['noClaims', r1], ['anon', r1]], (r, p) => update(r, p, { status: 'resolved' }));
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
