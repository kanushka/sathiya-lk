// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminDb, adminWithSchool, expectFnError, linkedTeacher, makeSuper, signUp, teacherInput } from './helpers';

const teacherDoc = (sid: string, tid: string) => adminDb.doc(`${paths.teachers(sid)}/${tid}`);

async function teacher(staffId: string) {
  const { admin, sid } = await adminWithSchool();
  const { teacher: t, teacherId } = await linkedTeacher(admin, sid, staffId);
  return { admin, sid, teacherId, t };
}

describe('setMyPhone', () => {
  it('sets, tidies and clears the caller’s own phone and nothing else', async () => {
    const { sid, teacherId, t } = await teacher('SCC401');
    const before = (await teacherDoc(sid, teacherId).get()).data()!;
    expect(await t.call('setMyPhone', { schoolId: sid, phone: ' 071 234  5678 ' })).toEqual({ phone: '071 234 5678' });
    const after = (await teacherDoc(sid, teacherId).get()).data()!;
    expect(after).toEqual({ ...before, phone: '071 234 5678' });

    expect(await t.call('setMyPhone', { schoolId: sid, phone: '' })).toEqual({ phone: null });
    expect((await teacherDoc(sid, teacherId).get()).get('phone')).toBeUndefined();
  });

  it('refuses a value that is not a phone number', async () => {
    const { sid, teacherId, t } = await teacher('SCC402');
    await teacherDoc(sid, teacherId).update({ phone: '0771234567' });
    for (const phone of ['call me', '123', '1'.repeat(31)]) {
      await expectFnError(t.call('setMyPhone', { schoolId: sid, phone }), 'invalid-argument', 'invalid');
    }
    await expectFnError(t.call('setMyPhone', { schoolId: sid, phone: 712345678 as unknown as string }), 'invalid-argument', 'invalid');
    expect((await teacherDoc(sid, teacherId).get()).get('phone')).toBe('0771234567');
  });

  it('cannot reach another teacher’s record, whatever the request says', async () => {
    const { admin, sid, t } = await teacher('SCC403');
    const { teacherId: other } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC404'), phone: '0771234567' } });
    await t.call('setMyPhone', { schoolId: sid, phone: '0112223334', teacherId: other } as never);
    expect((await teacherDoc(sid, other).get()).get('phone')).toBe('0771234567');
  });

  it('refuses an admin without a teacher link and a user of another school', async () => {
    const { admin, sid } = await adminWithSchool();
    await expectFnError(admin.call('setMyPhone', { schoolId: sid, phone: '0771234567' }), 'permission-denied', 'not-allowed');
    const { sid: otherSid } = await teacher('SCC405');
    const stranger = await signUp();
    await expectFnError(stranger.call('setMyPhone', { schoolId: otherSid, phone: '0771234567' }), 'permission-denied', 'not-allowed');
  });

  it('refuses a teacher whose link was removed while the claim lives on', async () => {
    const { sid, teacherId, t } = await teacher('SCC406');
    await teacherDoc(sid, teacherId).update({ uid: 'someone-else' });
    await expectFnError(t.call('setMyPhone', { schoolId: sid, phone: '0771234567' }), 'permission-denied', 'not-allowed');
  });

  it('refuses a teacher of a disabled school', async () => {
    const { sid, t } = await teacher('SCC407');
    const sup = await signUp();
    await makeSuper(sup);
    await sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' });
    await expectFnError(t.call('setMyPhone', { schoolId: sid, phone: '0771234567' }), 'failed-precondition', 'school-disabled');
  });
});

describe('myReliefCount', () => {
  it('returns only the caller’s count for the active year', async () => {
    const { admin, sid, teacherId, t } = await teacher('SCC411');
    expect(await t.call('myReliefCount', { schoolId: sid })).toEqual({ count: 0 });

    const yearRef = adminDb.collection(paths.years(sid)).doc();
    await yearRef.set({ label: '2027', status: 'published' });
    await adminDb.doc(paths.school(sid)).update({ activeYearId: yearRef.id });
    await adminDb.doc(paths.reliefStats(sid, yearRef.id)).set({ counts: { [teacherId]: 7, 't-other': 3 } });
    expect(await t.call('myReliefCount', { schoolId: sid })).toEqual({ count: 7 });
    await expectFnError(admin.call('myReliefCount', { schoolId: sid }), 'permission-denied', 'not-allowed');
  });
});
