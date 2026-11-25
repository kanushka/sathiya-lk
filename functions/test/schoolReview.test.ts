// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type RegisterSchoolReq, type RegisterSchoolRes } from '@sathiya/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHECK_CENSUS_PER_IP_PER_DAY } from '../src/lib/rateLimit';
import { registerSchool } from '../src/registerSchool';
import { syncSchoolDirectory } from '../src/syncDirectory';
import {
  adminDb,
  adminWithSchool,
  approve,
  client,
  expectFnError,
  makeSuper,
  pendingSchool,
  randomCensus,
  rawCall,
  rawErr,
  schoolReq,
  signUp,
  teacherInput,
  uniq,
  type Client,
} from './helpers';

const APP_URL = 'https://app.sathiya.kanushka.com';
const SUPERS = 'sup-a@example.test, sup-b@example.test';

const freeCensus = (n: string) => adminDb.doc(paths.censusIndex(n)).delete();
const schoolDoc = async (sid: string) => (await adminDb.doc(paths.school(sid)).get()).data()!;
const dirExists = async (sid: string) => (await adminDb.doc(paths.directory(sid)).get()).exists;
const superMails = async (sid: string) =>
  (await adminDb.collection('mail').where('to', 'array-contains', 'sup-a@example.test').get()).docs
    .map((d) => d.data() as { to: string[]; message: { subject: string; html: string; text: string } })
    .filter((m) => m.message.text.includes(sid));

// In-process so SUPER_EMAILS can be stubbed (the emulated function reads functions/.env, where it is empty).
async function registerAsSuperNotified(c: Client, req: RegisterSchoolReq): Promise<string> {
  vi.stubEnv('SUPER_EMAILS', SUPERS);
  try {
    const auth = { uid: c.uid, token: { email: c.auth.currentUser!.email, email_verified: true } };
    const res = (await registerSchool.run({ data: req, auth, rawRequest: { headers: {} } } as never)) as RegisterSchoolRes;
    return res.schoolId;
  } finally {
    vi.unstubAllEnvs();
  }
}

afterEach(() => vi.unstubAllEnvs());

describe('registerSchool with a census number in the MOE list', () => {
  it('activates at once with the official details, lists it and sends supers an FYI', async () => {
    await freeCensus('10001');
    const c = await signUp();
    const req = schoolReq({
      type: 'private',
      censusNo: '10001',
      nameEn: 'Totally Different Name',
      nameSi: 'කිලිනොච්චි මධ්‍ය මහා විද්‍යාලය',
      district: 'Colombo',
      address: 'Fake street',
      grades: [1],
      medium: ['si'],
    });
    const sid = await registerAsSuperNotified(c, req);

    expect(await schoolDoc(sid)).toMatchObject({
      nameEn: 'Kilinochchi Madhya Maha Vidyalayam',
      nameSi: 'කිලිනොච්චි මධ්‍ය මහා විද්‍යාලය',
      district: 'Kilinochchi',
      address: 'A9 Road, Ananthapuram, Kilinochchi',
      city: 'Siripura',
      type: 'government',
      censusNo: '10001',
      grades: [6, 7, 8, 9, 10, 11, 12, 13],
      medium: ['ta', 'en'],
      status: 'active',
      review: { moeMatched: true },
    });
    expect(await dirExists(sid)).toBe(true);

    const mails = await superMails(sid);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toEqual(['sup-a@example.test', 'sup-b@example.test']);
    expect(mails[0]!.message.subject).toBe('New school (MOE listed): Kilinochchi Madhya Maha Vidyalayam · Sathiya (සතිය)');
    expect(mails[0]!.message.html).toContain(`href="${APP_URL}/super/schools/${sid}"`);
    expect(mails[0]!.message.text).toContain('Census no: 10001');
  });

  it("takes the user's district when the list has none, and still enforces the official name", async () => {
    await freeCensus('10002');
    const c = await signUp();
    const { schoolId } = await c.call('registerSchool', schoolReq({ censusNo: '10002', nameEn: 'Mine', nameSi: '', district: 'Kilinochchi' }));
    expect(await schoolDoc(schoolId)).toMatchObject({ nameEn: 'Kilinochchi Hindu College', district: 'Kilinochchi', status: 'active', type: 'government' });
    expect((await schoolDoc(schoolId)).nameSi).toBeUndefined();
  });
});

describe('registerSchool without a listed census number', () => {
  it('stays pending, off the directory, and mails supers a review with possible duplicates', async () => {
    const u = uniq();
    const district = `Kilinochchi ${u}`;
    const existing = await adminWithSchool();
    await adminDb.doc(paths.school(existing.sid)).update({ nameEn: `Kilinochchi Hindu College ${u}`, district });

    const c = await signUp();
    const sid = await registerAsSuperNotified(
      c,
      schoolReq({ nameEn: `Kilinochchi Hindu College ${u}`, district, type: 'private', medium: ['ta', 'en', 'ta'] }),
    );

    expect(await schoolDoc(sid)).toMatchObject({ status: 'pending', review: { moeMatched: false }, medium: ['ta', 'en'] });
    expect(await dirExists(sid)).toBe(false);

    const mails = await superMails(sid);
    expect(mails).toHaveLength(1);
    const { subject, html, text } = mails[0]!.message;
    expect(subject).toBe(`School to review: Kilinochchi Hindu College ${u} · Sathiya (සතිය)`);
    expect(html).toContain(`href="${APP_URL}/super/schools/${sid}"`);
    expect(html).not.toMatch(/href="[^"]*approve/i);
    expect(text).toContain(`Registrant: Principal <${c.auth.currentUser!.email}>`);
    const [, registered, moe, sameDistrict] = text.split(/Similar names, registered:|Similar names, MOE list:|Registered in [^\n]*:/);
    expect(registered).toContain(existing.sid);
    expect(moe).toContain('Kilinochchi Hindu College · 10002');
    expect(sameDistrict).toContain(existing.sid);
    expect(sameDistrict!.split('Review school:')[0]).not.toContain(sid);
  });

  it('refuses a medium outside si, en, ta', async () => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', schoolReq({ medium: ['fr' as 'si'] })), 'invalid-argument', 'invalid');
  });
});

describe('registerSchool terms version', () => {
  it('must equal platform/config currentTermsVersion', async () => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', { ...schoolReq(), acceptedTermsVersion: '0' }), 'invalid-argument', 'invalid');
    await adminDb.doc(paths.platform.config).set({ currentTermsVersion: '2' }, { merge: true });
    await expectFnError(c.call('registerSchool', schoolReq()), 'invalid-argument', 'invalid');
    await expect(c.call('registerSchool', { ...schoolReq(), acceptedTermsVersion: '2' })).resolves.toMatchObject({ schoolId: expect.any(String) });
    expect((await c.claims()).schools).toBeDefined();
  });
});

describe('directory sync and review status', () => {
  it('lists a school only while active (or suspended), never while pending or rejected', async () => {
    const { sid } = await pendingSchool();
    await adminDb.doc(paths.directory(sid)).set({ nameEn: 'stale', status: 'active' });
    await syncSchoolDirectory(sid);
    expect(await dirExists(sid)).toBe(false);

    await approve(sid);
    expect(await dirExists(sid)).toBe(true);

    await adminDb.doc(paths.school(sid)).update({ status: 'disabled' });
    await syncSchoolDirectory(sid);
    expect((await adminDb.doc(paths.directory(sid)).get()).get('status')).toBe('disabled');

    await adminDb.doc(paths.school(sid)).update({ status: 'rejected' });
    await syncSchoolDirectory(sid);
    expect(await dirExists(sid)).toBe(false);
  });
});

describe('a pending school is refused what needs approval', () => {
  it('publishYear, inviteAdmin, setJoinLink create, createTeacherLink, setSchoolStatus', async () => {
    const { admin, sid } = await pendingSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC041') });
    const pending = (p: Promise<unknown>) => expectFnError(p, 'failed-precondition', 'school-pending');
    await pending(admin.call('publishYear', { schoolId: sid, yearId: 'y2027' }));
    await pending(admin.call('inviteAdmin', { schoolId: sid, email: `x-${uniq()}@example.com` }));
    await pending(admin.call('setJoinLink', { schoolId: sid, action: 'create' }));
    await expect(admin.call('setJoinLink', { schoolId: sid, action: 'off' })).resolves.toEqual({});
    await pending(admin.call('createTeacherLink', { schoolId: sid, teacherId }));
    const sup = await signUp();
    await makeSuper(sup);
    await pending(sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' }));

    expect((await adminDb.collection(paths.invites(sid)).get()).size).toBe(0);
    expect((await adminDb.doc(paths.joinLink(sid)).get()).exists).toBe(false);
    expect((await schoolDoc(sid)).status).toBe('pending');
  });

  it('a rejected school gets school-rejected', async () => {
    const { admin, sid } = await pendingSchool();
    await adminDb.doc(paths.school(sid)).update({ status: 'rejected' });
    await expectFnError(admin.call('inviteAdmin', { schoolId: sid, email: `x-${uniq()}@example.com` }), 'failed-precondition', 'school-rejected');
  });

  it('joinSchool refuses both link kinds before writing', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC042') });
    const { token: teacherToken } = await admin.call('createTeacherLink', { schoolId: sid, teacherId });
    const { token: schoolToken } = await admin.call('setJoinLink', { schoolId: sid, action: 'create' });
    await adminDb.doc(paths.school(sid)).update({ status: 'pending' });

    const joiner = await signUp();
    await expectFnError(joiner.call('joinSchool', { token: teacherToken! }), 'failed-precondition', 'school-pending');
    await expectFnError(joiner.call('joinSchool', { token: schoolToken!, schoolId: sid, staffId: 'SCC042' }), 'failed-precondition', 'school-pending');
    expect((await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).get('uid')).toBeUndefined();
    expect((await adminDb.collection(paths.joinRequests(sid)).get()).size).toBe(0);
    expect(await joiner.claims()).toEqual({});
  });
});

describe('lookupCensus', () => {
  it('answers listed, registered and unlisted to a signed-out caller', async () => {
    await freeCensus('10003');
    const anon = client();
    await expect(anon.call('lookupCensus', { censusNo: '10003' })).resolves.toEqual({
      status: 'listed',
      school: {
        censusNo: '10003',
        name: "St. Theresa's Girls' College",
        address: 'KARADIPPOKKU, KILINOCHCHI',
        level: 'Provincial',
        grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        media: ['ta', 'en'],
        sex: 'Girls',
      },
    });

    const n = randomCensus();
    await expect(anon.call('lookupCensus', { censusNo: n })).resolves.toEqual({ status: 'unlisted' });
    await (await signUp()).call('registerSchool', schoolReq({ type: 'government', censusNo: n }));
    await expect(anon.call('lookupCensus', { censusNo: n })).resolves.toEqual({ status: 'registered' });
  });

  it('rejects a malformed census number', async () => {
    await expectFnError(client().call('lookupCensus', { censusNo: '12a' }), 'invalid-argument', 'invalid');
    await expectFnError(client().call('lookupCensus', { censusNo: '__proto__' }), 'invalid-argument', 'invalid');
  });

  it('shares the per-IP census budget with checkCensusNo', async () => {
    const ip = '203.0.113.90';
    for (let i = 0; i < CHECK_CENSUS_PER_IP_PER_DAY - 1; i++) {
      expect((await rawCall('lookupCensus', { censusNo: '654321' }, { ip })).result).toEqual({ status: 'unlisted' });
    }
    expect((await rawCall('checkCensusNo', { censusNo: '654321' }, { ip })).result).toEqual({ available: true });
    expect(rawErr(await rawCall('lookupCensus', { censusNo: '654321' }, { ip }))).toEqual({ status: 'RESOURCE_EXHAUSTED', code: 'rate-limited' });
    expect((await rawCall('lookupCensus', { censusNo: '654321' }, { ip: '203.0.113.91' })).result).toEqual({ status: 'unlisted' });
  });
});
