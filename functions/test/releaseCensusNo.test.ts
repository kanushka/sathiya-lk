// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, syntheticEmail } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { adminDb, expectFnError, makeSuper, randomCensus, schoolReq, signIn, signUp, teacherInput } from './helpers';

async function schoolWithCensus() {
  const censusNo = randomCensus();
  const admin = await signUp();
  const { schoolId: sid } = await admin.call('registerSchool', schoolReq({ type: 'government', censusNo }));
  await admin.auth.currentUser!.getIdToken(true);
  return { admin, sid, censusNo };
}

async function superClient() {
  const sup = await signUp();
  await makeSuper(sup);
  return sup;
}

describe('releaseCensusNo', () => {
  it('frees the census number, clears it on the school and records who released it', async () => {
    const { sid, censusNo } = await schoolWithCensus();
    const sup = await superClient();
    const before = Date.now();
    await expect(sup.call('releaseCensusNo', { schoolId: sid })).resolves.toEqual({ censusNo, freed: true });

    expect((await adminDb.doc(paths.censusIndex(censusNo)).get()).exists).toBe(false);
    const school = (await adminDb.doc(paths.school(sid)).get()).data()!;
    expect(school.censusNo).toBeUndefined();
    expect(school.censusReleasedBy).toBe(sup.uid);
    expect(school.censusReleasedAt).toBeGreaterThanOrEqual(before);
    expect(school.releasedCensusNo).toBe(censusNo);

    const other = await signUp();
    await expect(other.call('registerSchool', schoolReq({ type: 'government', censusNo }))).resolves.toMatchObject({ schoolId: expect.any(String) });
  });

  it('refuses the school admin, a teacher and a plain user', async () => {
    const { admin, sid, censusNo } = await schoolWithCensus();
    const { password } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC031') });
    const teacher = await signIn(syntheticEmail('SCC031', sid), password);
    for (const c of [admin, teacher, await signUp()]) {
      await expectFnError(c.call('releaseCensusNo', { schoolId: sid }), 'permission-denied', 'not-allowed');
    }
    expect((await adminDb.doc(paths.censusIndex(censusNo)).get()).data()).toEqual({ schoolId: sid });
    expect((await adminDb.doc(paths.school(sid)).get()).get('censusNo')).toBe(censusNo);
  });

  it('leaves an index entry that points at another school alone but clears this school', async () => {
    const { sid, censusNo } = await schoolWithCensus();
    await adminDb.doc(paths.censusIndex(censusNo)).set({ schoolId: 'someone-else' });
    const sup = await superClient();
    await expect(sup.call('releaseCensusNo', { schoolId: sid })).resolves.toEqual({ censusNo, freed: false });
    expect((await adminDb.doc(paths.censusIndex(censusNo)).get()).data()).toEqual({ schoolId: 'someone-else' });
    expect((await adminDb.doc(paths.school(sid)).get()).get('censusNo')).toBeUndefined();
  });

  it('clears the school field when the index entry is already gone', async () => {
    const { sid, censusNo } = await schoolWithCensus();
    await adminDb.doc(paths.censusIndex(censusNo)).delete();
    const sup = await superClient();
    await expect(sup.call('releaseCensusNo', { schoolId: sid })).resolves.toEqual({ censusNo, freed: false });
    expect((await adminDb.doc(paths.school(sid)).get()).get('censusNo')).toBeUndefined();
  });

  it('rejects a school without a census number and an unknown school', async () => {
    const admin = await signUp();
    const { schoolId: sid } = await admin.call('registerSchool', schoolReq());
    const sup = await superClient();
    await expectFnError(sup.call('releaseCensusNo', { schoolId: sid }), 'failed-precondition', 'invalid');
    expect((await adminDb.doc(paths.school(sid)).get()).get('censusReleasedAt')).toBeUndefined();
    await expectFnError(sup.call('releaseCensusNo', { schoolId: 'no-such-school' }), 'not-found', 'invalid');
    await expectFnError(sup.call('releaseCensusNo', {} as never), 'invalid-argument', 'invalid');
  });
});
