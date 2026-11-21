import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminDb, adminWithSchool, expectFnError, makeSuper, signUp } from './helpers';

describe('setSchoolStatus', () => {
  it('refuses a non-super caller, including the school admin', async () => {
    const { admin, sid } = await adminWithSchool();
    await expectFnError(admin.call('setSchoolStatus', { schoolId: sid, status: 'disabled' }), 'permission-denied', 'not-allowed');
    const stranger = await signUp();
    await expectFnError(stranger.call('setSchoolStatus', { schoolId: sid, status: 'disabled' }), 'permission-denied', 'not-allowed');
    expect((await adminDb.doc(paths.school(sid)).get()).data()?.status).toBe('active');
  });

  it('updates the school and directory status for a super admin', async () => {
    const { sid } = await adminWithSchool();
    const sup = await signUp();
    await makeSuper(sup);

    await expect(sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' })).resolves.toEqual({ ok: true });
    expect((await adminDb.doc(paths.school(sid)).get()).data()?.status).toBe('disabled');
    expect((await adminDb.doc(paths.directory(sid)).get()).data()?.status).toBe('disabled');

    await sup.call('setSchoolStatus', { schoolId: sid, status: 'active' });
    expect((await adminDb.doc(paths.school(sid)).get()).data()?.status).toBe('active');
    expect((await adminDb.doc(paths.directory(sid)).get()).data()?.status).toBe('active');
  });

  it('rejects a bad status or unknown school', async () => {
    const { sid } = await adminWithSchool();
    const sup = await signUp();
    await makeSuper(sup);
    await expectFnError(sup.call('setSchoolStatus', { schoolId: sid, status: 'gone' as 'active' }), 'invalid-argument', 'invalid');
    await expectFnError(sup.call('setSchoolStatus', { schoolId: 'no-such-school', status: 'disabled' }), 'not-found', 'invalid');
  });
});
