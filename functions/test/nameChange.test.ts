// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type RequestNameChangeReq } from '@sathiya/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestNameChange } from '../src/requestNameChange';
import { adminDb, adminWithSchool, expectFnError, linkedTeacher, makeSuper, pendingSchool, signUp, type Client } from './helpers';

const APP_URL = 'https://app.sathiya.kanushka.com';
const SUPERS = 'sup-a@example.test, sup-b@example.test';

const schoolDoc = async (sid: string) => (await adminDb.doc(paths.school(sid)).get()).data()!;
const mails = async (email: string, sid: string) =>
  (await adminDb.collection('mail').where('to', 'array-contains', email.toLowerCase()).get()).docs
    .map((d) => d.data() as { to: string[]; message: { subject: string; html: string; text: string } })
    .filter((m) => m.message.text.includes(sid) || m.message.subject.includes('name'));

async function superClient(): Promise<Client> {
  const sup = await signUp();
  await makeSuper(sup);
  return sup;
}

async function listedSchool(): Promise<{ admin: Client; sid: string }> {
  const r = await adminWithSchool();
  await adminDb.doc(paths.school(r.sid)).update({ nameEn: 'Batapola Sri Kalyanathissa K.V.', censusNo: '10001', review: { moeMatched: true } });
  return r;
}

// In-process so SUPER_EMAILS can be stubbed (the emulated function reads functions/.env, where it is empty).
async function requestAsSuperNotified(c: Client, req: RequestNameChangeReq): Promise<void> {
  vi.stubEnv('SUPER_EMAILS', SUPERS);
  try {
    const { claims } = await c.auth.currentUser!.getIdTokenResult(true);
    const auth = { uid: c.uid, token: { ...claims, email: c.auth.currentUser!.email, email_verified: true } };
    await requestNameChange.run({ data: req, auth, rawRequest: { headers: {} } } as never);
  } finally {
    vi.unstubAllEnvs();
  }
}

afterEach(() => vi.unstubAllEnvs());

describe('requestNameChange', () => {
  it('records a pending request, keeps the current name and directory entry, and mails supers all three names', async () => {
    const { admin, sid } = await listedSchool();
    await adminDb.doc(paths.directory(sid)).update({ nameEn: 'Batapola Sri Kalyanathissa K.V.' });
    const before = Date.now();
    await requestAsSuperNotified(admin, { schoolId: sid, nameEn: '  G/ Sri Kalyanathissa K.V. ', nameSi: 'ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.' });

    const school = await schoolDoc(sid);
    expect(school.nameEn).toBe('Batapola Sri Kalyanathissa K.V.');
    expect(school.nameChange).toMatchObject({
      nameEn: 'G/ Sri Kalyanathissa K.V.',
      nameSi: 'ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.',
      moeName: 'Kilinochchi Madhya Maha Vidyalayam',
      status: 'pending',
      requestedBy: admin.uid,
    });
    expect(school.nameChange.requestedAt).toBeGreaterThanOrEqual(before);
    expect((await adminDb.doc(paths.directory(sid)).get()).get('nameEn')).toBe('Batapola Sri Kalyanathissa K.V.');

    const sent = await mails('sup-a@example.test', sid);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toEqual(['sup-a@example.test', 'sup-b@example.test']);
    expect(sent[0]!.message.subject).toContain('Name change to review: Batapola Sri Kalyanathissa K.V.');
    const text = sent[0]!.message.text;
    expect(text).toContain('MOE list name: Kilinochchi Madhya Maha Vidyalayam');
    expect(text).toContain('Current name: Batapola Sri Kalyanathissa K.V.');
    expect(text).toContain('Requested name: G/ Sri Kalyanathissa K.V.');
    expect(text).toContain('Requested Sinhala name: ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.');
    expect(sent[0]!.message.html).toContain(`href="${APP_URL}/super/schools/${sid}"`);
  });

  it('says when the school is not in the MOE list', async () => {
    const { admin, sid } = await pendingSchool();
    await requestAsSuperNotified(admin, { schoolId: sid, nameEn: 'Siripura Royal College' });
    expect((await schoolDoc(sid)).nameChange).toMatchObject({ nameEn: 'Siripura Royal College', status: 'pending' });
    expect((await schoolDoc(sid)).nameChange.nameSi).toBeUndefined();
    const sent = await mails('sup-a@example.test', sid);
    expect(sent[0]!.message.text).toContain('MOE list name: Not in the MOE list');
  });

  it('replaces an earlier pending or rejected request, and does not mail twice for the same request', async () => {
    const { admin, sid } = await listedSchool();
    await requestAsSuperNotified(admin, { schoolId: sid, nameEn: 'First Try' });
    await requestAsSuperNotified(admin, { schoolId: sid, nameEn: 'First Try' });
    expect(await mails('sup-a@example.test', sid)).toHaveLength(1);
    await adminDb.doc(paths.school(sid)).update({ 'nameChange.status': 'rejected', 'nameChange.reason': 'No' });
    await requestAsSuperNotified(admin, { schoolId: sid, nameEn: 'First Try' });
    const nc = (await schoolDoc(sid)).nameChange;
    expect(nc).toMatchObject({ nameEn: 'First Try', status: 'pending' });
    expect(nc.reason).toBeUndefined();
    expect(await mails('sup-a@example.test', sid)).toHaveLength(2);
  });

  it('refuses an unchanged or empty name', async () => {
    const { admin, sid } = await adminWithSchool();
    const s = await schoolDoc(sid);
    await expectFnError(admin.call('requestNameChange', { schoolId: sid, nameEn: s.nameEn, nameSi: s.nameSi }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('requestNameChange', { schoolId: sid, nameEn: ' ', nameSi: '' }), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('requestNameChange', { schoolId: sid, nameEn: 'x'.repeat(201) }), 'invalid-argument', 'invalid');
    expect((await schoolDoc(sid)).nameChange).toBeUndefined();
  });

  it('refuses a teacher, another user, and a suspended school', async () => {
    const { admin, sid } = await adminWithSchool();
    const { teacher } = await linkedTeacher(admin, sid, 'SCC051');
    for (const c of [teacher, await signUp()]) {
      await expectFnError(c.call('requestNameChange', { schoolId: sid, nameEn: 'New' }), 'permission-denied', 'not-allowed');
    }
    await adminDb.doc(paths.school(sid)).update({ status: 'disabled' });
    await expectFnError(admin.call('requestNameChange', { schoolId: sid, nameEn: 'New' }), 'failed-precondition', 'school-disabled');
    expect((await schoolDoc(sid)).nameChange).toBeUndefined();
  });
});

describe('decideNameChange', () => {
  async function requested(nameSi?: string) {
    const r = await listedSchool();
    await r.admin.call('requestNameChange', { schoolId: r.sid, nameEn: 'G/ Sri Kalyanathissa K.V.', ...(nameSi !== undefined && { nameSi }) });
    return r;
  }

  it('approves: renames the school, its directory entry and published timetables, clears the request, mails the admins', async () => {
    const { admin, sid } = await requested('ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.');
    const old = { nameEn: 'Batapola Sri Kalyanathissa K.V.' };
    await adminDb.doc(`${paths.publishedClasses(sid, 'y1')}/c1`).set({ classId: 'c1', schoolName: old });
    await adminDb.doc(`${paths.publishedTeachers(sid, 'y1')}/t1`).set({ teacherId: 't1', schoolName: old });
    const sup = await superClient();
    await expect(sup.call('decideNameChange', { schoolId: sid, approve: true })).resolves.toEqual({ ok: true });

    const school = await schoolDoc(sid);
    expect(school).toMatchObject({ nameEn: 'G/ Sri Kalyanathissa K.V.', nameSi: 'ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.' });
    expect(school.nameChange).toBeUndefined();
    expect((await adminDb.doc(paths.directory(sid)).get()).data()).toMatchObject({ nameEn: 'G/ Sri Kalyanathissa K.V.', nameSi: 'ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.' });
    const want = { nameEn: 'G/ Sri Kalyanathissa K.V.', nameSi: 'ගා/ ශ්‍රී කල්‍යාණතිස්ස ක.වි.' };
    expect((await adminDb.doc(`${paths.publishedClasses(sid, 'y1')}/c1`).get()).get('schoolName')).toEqual(want);
    expect((await adminDb.doc(`${paths.publishedTeachers(sid, 'y1')}/t1`).get()).get('schoolName')).toEqual(want);

    const sent = (await mails(admin.auth.currentUser!.email!, sid)).find((m) => m.message.subject.includes('name change is approved'));
    expect(sent?.message.text).toContain('G/ Sri Kalyanathissa K.V.');
  });

  it('approving a request without a Sinhala name removes the old Sinhala name', async () => {
    const { sid } = await listedSchool();
    await adminDb.doc(paths.school(sid)).update({ nameSi: 'පරණ නම' });
    const admin = (await adminDb.collection(paths.members(sid)).where('role', '==', 'admin').get()).docs[0]!.id;
    await adminDb.doc(paths.school(sid)).update({ nameChange: { nameEn: 'New Name', status: 'pending', requestedAt: 1, requestedBy: admin } });
    await (await superClient()).call('decideNameChange', { schoolId: sid, approve: true });
    const school = await schoolDoc(sid);
    expect(school.nameEn).toBe('New Name');
    expect(school.nameSi).toBeUndefined();
  });

  it('rejects with a reason: name unchanged, request kept as rejected, admins mailed the reason', async () => {
    const { admin, sid } = await requested();
    const sup = await superClient();
    await sup.call('decideNameChange', { schoolId: sid, approve: false, reason: '  Use the name on the MOE letter  ' });
    const school = await schoolDoc(sid);
    expect(school.nameEn).toBe('Batapola Sri Kalyanathissa K.V.');
    expect(school.nameChange).toMatchObject({ nameEn: 'G/ Sri Kalyanathissa K.V.', status: 'rejected', reason: 'Use the name on the MOE letter', decidedBy: sup.uid });
    const sent = (await mails(admin.auth.currentUser!.email!, sid)).find((m) => m.message.subject.includes('name change was not approved'));
    expect(sent?.message.text).toContain('Use the name on the MOE letter');
  });

  it('requires a reason of at most 500 characters to reject', async () => {
    const { sid } = await requested();
    const sup = await superClient();
    for (const reason of [undefined, '', '   ', 'x'.repeat(501)]) {
      await expectFnError(sup.call('decideNameChange', { schoolId: sid, approve: false, reason } as never), 'invalid-argument', 'invalid');
    }
    expect((await schoolDoc(sid)).nameChange.status).toBe('pending');
  });

  it('works only on a pending request, and only for a super admin', async () => {
    const { admin, sid } = await requested();
    await expectFnError(admin.call('decideNameChange', { schoolId: sid, approve: true }), 'permission-denied', 'not-allowed');
    const sup = await superClient();
    await sup.call('decideNameChange', { schoolId: sid, approve: false, reason: 'No' });
    await expectFnError(sup.call('decideNameChange', { schoolId: sid, approve: true }), 'failed-precondition', 'invalid');
    const { sid: none } = await adminWithSchool();
    await expectFnError(sup.call('decideNameChange', { schoolId: none, approve: true }), 'failed-precondition', 'invalid');
    await expectFnError(sup.call('decideNameChange', { schoolId: 'no-such-school', approve: true }), 'not-found', 'invalid');
  });
});
