// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminDb, adminWithSchool, expectFnError, linkedTeacher, makeSuper, pendingSchool, randomCensus, schoolReq, signUp, type Client } from './helpers';

const APP_URL = 'https://app.sathiya.kanushka.com';
const REPLY_TO = 'sathiya@kanushka.com';

const schoolDoc = async (sid: string) => (await adminDb.doc(paths.school(sid)).get()).data();
const exists = async (p: string) => (await adminDb.doc(p).get()).exists;
const mailsTo = async (email: string) =>
  (await adminDb.collection('mail').where('to', 'array-contains', email.toLowerCase()).get()).docs.map(
    (d) => d.data() as { to: string[]; message: { subject: string; html: string; text: string } },
  );

async function superClient(): Promise<Client> {
  const sup = await signUp();
  await makeSuper(sup);
  return sup;
}

async function rejected(): Promise<{ admin: Client; sid: string }> {
  const r = await pendingSchool();
  await (await superClient()).call('reviewSchool', { schoolId: r.sid, approve: false, reason: 'Not a real school' });
  return r;
}

describe('reviewSchool', () => {
  it('approves a pending school: active, listed, decision recorded, admin emailed with the admin link', async () => {
    const { admin, sid } = await pendingSchool();
    const sup = await superClient();
    const before = Date.now();
    await expect(sup.call('reviewSchool', { schoolId: sid, approve: true })).resolves.toEqual({ ok: true });

    const school = await schoolDoc(sid);
    expect(school).toMatchObject({ status: 'active', review: { moeMatched: false, decidedBy: sup.uid } });
    expect(school!.review.decidedAt).toBeGreaterThanOrEqual(before);
    expect(school!.review.reason).toBeUndefined();
    expect((await adminDb.doc(paths.directory(sid)).get()).data()).toMatchObject({ nameEn: 'Siripura Central College', status: 'active' });

    const mail = (await mailsTo(admin.auth.currentUser!.email!)).find((m) => m.message.subject.includes('is approved'));
    expect(mail?.message.text).toContain(`${APP_URL}/s/${sid}/admin`);
  });

  it('rejects with a reason: rejected, census released, admin emailed with the reason and contact address', async () => {
    const censusNo = randomCensus();
    const { admin, sid } = await pendingSchool({ type: 'government', censusNo });
    expect(await exists(paths.censusIndex(censusNo))).toBe(true);
    const sup = await superClient();
    await expect(sup.call('reviewSchool', { schoolId: sid, approve: false, reason: '  No such school in Siripura  ' })).resolves.toEqual({ ok: true });

    const school = await schoolDoc(sid);
    expect(school).toMatchObject({
      status: 'rejected',
      review: { moeMatched: false, reason: 'No such school in Siripura', decidedBy: sup.uid },
      releasedCensusNo: censusNo,
      censusReleasedBy: sup.uid,
    });
    expect(school!.censusNo).toBeUndefined();
    expect(await exists(paths.censusIndex(censusNo))).toBe(false);
    expect(await exists(paths.directory(sid))).toBe(false);

    const mail = (await mailsTo(admin.auth.currentUser!.email!)).find((m) => m.message.subject.includes('was not approved'));
    expect(mail?.message.text).toContain('No such school in Siripura');
    expect(mail?.message.text).toContain(REPLY_TO);

    const other = await signUp();
    await expect(other.call('registerSchool', schoolReq({ type: 'government', censusNo }))).resolves.toMatchObject({ schoolId: expect.any(String) });
  });

  it('rejects a school without a census number', async () => {
    const { sid } = await pendingSchool();
    const sup = await superClient();
    await sup.call('reviewSchool', { schoolId: sid, approve: false, reason: 'Duplicate' });
    expect(await schoolDoc(sid)).toMatchObject({ status: 'rejected', review: { reason: 'Duplicate' } });
    expect((await schoolDoc(sid))!.censusReleasedAt).toBeUndefined();
  });

  it('requires a reason of at most 500 characters to reject', async () => {
    const { sid } = await pendingSchool();
    const sup = await superClient();
    for (const reason of [undefined, '', '   ', 'x'.repeat(501), 5]) {
      await expectFnError(sup.call('reviewSchool', { schoolId: sid, approve: false, reason } as never), 'invalid-argument', 'invalid');
    }
    await expectFnError(sup.call('reviewSchool', { schoolId: sid } as never), 'invalid-argument', 'invalid');
    expect((await schoolDoc(sid))!.status).toBe('pending');
    await sup.call('reviewSchool', { schoolId: sid, approve: false, reason: 'x'.repeat(500) });
    expect((await schoolDoc(sid))!.review.reason).toHaveLength(500);
  });

  it('works only on a pending school', async () => {
    const sup = await superClient();
    const { sid: active } = await adminWithSchool();
    const { sid: done } = await rejected();
    for (const sid of [active, done]) {
      await expectFnError(sup.call('reviewSchool', { schoolId: sid, approve: true }), 'failed-precondition', 'invalid');
      await expectFnError(sup.call('reviewSchool', { schoolId: sid, approve: false, reason: 'x' }), 'failed-precondition', 'invalid');
    }
    expect((await schoolDoc(active))!.status).toBe('active');
    expect((await schoolDoc(done))!.status).toBe('rejected');
    await expectFnError(sup.call('reviewSchool', { schoolId: 'no-such-school', approve: true }), 'not-found', 'invalid');
  });

  it('refuses the school admin and a plain user', async () => {
    const { admin, sid } = await pendingSchool();
    for (const c of [admin, await signUp()]) {
      await expectFnError(c.call('reviewSchool', { schoolId: sid, approve: true }), 'permission-denied', 'not-allowed');
    }
    expect((await schoolDoc(sid))!.status).toBe('pending');
  });
});

describe('removeRegistration', () => {
  it('deletes a rejected school, its links and directory entry, and drops it from every member’s claims', async () => {
    const { admin, sid } = await pendingSchool();
    const { teacher } = await linkedTeacher(admin, sid, 'SCC041');
    const { sid: otherSid } = await adminWithSchool();
    await adminDb.doc(`${paths.invites(sid)}/x@example.com`).set({ email: 'x@example.com', invitedBy: admin.uid, createdAt: 1 });
    await adminDb.doc(paths.joinLink(sid)).set({ hash: 'h', token: 't', createdAt: 1, createdBy: admin.uid });
    await adminDb.collection(paths.teacherLinks()).doc(`l-${sid}`).set({ sid, teacherId: 't', createdAt: 1 });
    await adminDb.collection(paths.teacherLinks()).doc(`l-${otherSid}`).set({ sid: otherSid, teacherId: 't', createdAt: 1 });
    await (await superClient()).call('reviewSchool', { schoolId: sid, approve: false, reason: 'Not real' });
    await adminDb.doc(paths.directory(sid)).set({ nameEn: 'stale', status: 'rejected' });

    await expect(admin.call('removeRegistration', { schoolId: sid })).resolves.toEqual({ ok: true });

    expect(await exists(paths.school(sid))).toBe(false);
    expect((await adminDb.doc(paths.school(sid)).listCollections()).length).toBe(0);
    expect(await exists(paths.directory(sid))).toBe(false);
    expect(await exists(`teacherLinks/l-${sid}`)).toBe(false);
    expect(await exists(`teacherLinks/l-${otherSid}`)).toBe(true);
    expect((await admin.claims()).schools?.[sid]).toBeUndefined();
    expect((await teacher.claims()).schools?.[sid]).toBeUndefined();
    expect(await exists(paths.school(otherSid))).toBe(true);
  });

  it('works only on a rejected school', async () => {
    const { admin: pAdmin, sid: pending } = await pendingSchool();
    const { admin: aAdmin, sid: active } = await adminWithSchool();
    await expectFnError(pAdmin.call('removeRegistration', { schoolId: pending }), 'failed-precondition', 'invalid');
    await expectFnError(aAdmin.call('removeRegistration', { schoolId: active }), 'failed-precondition', 'invalid');
    expect(await exists(paths.school(pending))).toBe(true);
    expect(await exists(paths.school(active))).toBe(true);
  });

  it('refuses a teacher, another user and super', async () => {
    const { admin, sid } = await pendingSchool();
    const { teacher } = await linkedTeacher(admin, sid, 'SCC042');
    await (await superClient()).call('reviewSchool', { schoolId: sid, approve: false, reason: 'Not real' });
    for (const c of [teacher, await signUp(), await superClient()]) {
      await expectFnError(c.call('removeRegistration', { schoolId: sid }), 'permission-denied', 'not-allowed');
    }
    expect(await exists(paths.school(sid))).toBe(true);
  });
});
