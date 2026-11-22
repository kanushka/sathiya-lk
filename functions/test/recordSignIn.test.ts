// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, syntheticEmail } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminDb, adminWithSchool, expectFnError, makeSuper, signIn, signUp, teacherInput } from './helpers';

const lastLogin = async (sid: string, tid: string) => (await adminDb.doc(`${paths.teachers(sid)}/${tid}`).get()).get('lastLoginAt') as number | undefined;

async function teacher(staffId: string) {
  const { admin, sid } = await adminWithSchool();
  const { teacherId, password } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput(staffId) });
  const t = await signIn(syntheticEmail(staffId, sid), password);
  return { admin, sid, teacherId, t };
}

describe('recordSignIn', () => {
  it('stamps the calling teacher with the server time', async () => {
    const { sid, teacherId, t } = await teacher('SCC301');
    const before = Date.now();
    expect(await t.call('recordSignIn', {})).toEqual({ recorded: true });
    const at = await lastLogin(sid, teacherId);
    expect(at).toBeGreaterThanOrEqual(before - 5_000);
    const doc = (await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).get()).data()!;
    expect(doc.staffId).toBe('SCC301');
  });

  it('skips the write when the last sign-in is under ten minutes old', async () => {
    const { sid, teacherId, t } = await teacher('SCC302');
    const recent = Date.now() - 60_000;
    await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).update({ lastLoginAt: recent });
    expect(await t.call('recordSignIn', {})).toEqual({ recorded: false });
    expect(await lastLogin(sid, teacherId)).toBe(recent);

    await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).update({ lastLoginAt: Date.now() - 11 * 60_000 });
    expect(await t.call('recordSignIn', {})).toEqual({ recorded: true });
    expect(await lastLogin(sid, teacherId)).toBeGreaterThan(recent);
  });

  it('is a no-op for an admin without a teacher link', async () => {
    const { admin, sid } = await adminWithSchool();
    expect(await admin.call('recordSignIn', {})).toEqual({ recorded: false });
    const teachers = await adminDb.collection(paths.teachers(sid)).get();
    expect(teachers.docs.every((d) => d.get('lastLoginAt') === undefined)).toBe(true);
  });

  it('only touches the caller’s own record', async () => {
    const { admin, sid, t } = await teacher('SCC303');
    const { teacherId: other } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC304') });
    await t.call('recordSignIn', {});
    expect(await lastLogin(sid, other)).toBeUndefined();
  });

  it('refuses a teacher of a disabled school without stamping', async () => {
    const { sid, teacherId, t } = await teacher('SCC305');
    const sup = await signUp();
    await makeSuper(sup);
    await sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' });
    await expectFnError(t.call('recordSignIn', {}), 'failed-precondition', 'school-disabled');
    expect(await lastLogin(sid, teacherId)).toBeUndefined();
  });
});
