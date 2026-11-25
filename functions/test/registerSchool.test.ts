// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { callables, paths, type PeriodTemplate } from '@sathiya/core';
import { defaultTemplate } from '@sathiya/core/fixtures';
import { httpsCallable } from 'firebase/functions';
import { describe, expect, it } from 'vitest';
import type { RegisterSchoolReq as RegisterSchoolInput } from '@sathiya/core';
import { adminDb, approve, client, expectFnError, makeSuper, schoolReq, signUp } from './helpers';

describe('unauthenticated', () => {
  it.each(Object.keys(callables).filter((n) => !['saveEntry', 'deleteEntry', 'publishYear', 'deleteSetupItem', 'reportSchool', 'sendAuthEmail', 'checkCensusNo', 'lookupCensus'].includes(n)))(
    '%s refuses a signed-out caller',
    async (name) => {
      const c = client();
      await expectFnError(httpsCallable(c.functions, name)({ schoolId: 'x' }), 'unauthenticated', 'not-allowed');
    },
  );
});

describe('registerSchool', () => {
  it('creates a pending school, admin member, default template and sets claims; directory waits for approval', async () => {
    const c = await signUp();
    const before = Date.now();
    const { schoolId } = await c.call('registerSchool', schoolReq());
    expect(schoolId).toMatch(/^[A-Za-z0-9]{20}$/);

    expect(await c.claims()).toEqual({ schools: { [schoolId]: { r: 'a' } } });

    const school = (await adminDb.doc(paths.school(schoolId)).get()).data()!;
    expect(school).toMatchObject({
      nameEn: 'Siripura Central College',
      district: 'Kurunegala',
      city: 'Siripura',
      staffPrefix: 'SCC',
      type: 'private',
      status: 'pending',
      review: { moeMatched: false },
      termsVersion: '1',
      acceptedTerms: { version: '1' },
    });
    expect(school.createdAt).toBeGreaterThanOrEqual(before);
    expect(school.acceptedTerms.at).toBeGreaterThanOrEqual(before);

    expect((await adminDb.doc(paths.directory(schoolId)).get()).exists).toBe(false);
    await approve(schoolId);
    const dir = (await adminDb.doc(paths.directory(schoolId)).get()).data();
    expect(dir).toEqual({
      nameEn: 'Siripura Central College',
      nameSi: 'සිරිපුර මධ්‍ය විද්‍යාලය',
      district: 'Kurunegala',
      city: 'Siripura',
      type: 'private',
      status: 'active',
      nameLower: 'siripura central college',
      cityLower: 'siripura',
    });

    const member = (await adminDb.doc(`${paths.members(schoolId)}/${c.uid}`).get()).data();
    expect(member).toMatchObject({ uid: c.uid, role: 'admin', name: 'Principal' });

    const tpls = await adminDb.collection(paths.templates(schoolId)).get();
    expect(tpls.size).toBe(1);
    const tpl = tpls.docs[0]!.data() as PeriodTemplate;
    expect(tpl).toMatchObject({ isDefault: true, mode: 'same', name: 'School default' });
    expect(tpl.rows).toEqual(defaultTemplate.rows);
    expect(tpl.rows.filter((r) => r.type === 'period')).toHaveLength(8);
    expect(tpl.rows.filter((r) => r.type === 'interval')).toHaveLength(1);
  });

  it('keeps an existing super flag', async () => {
    const c = await signUp();
    await makeSuper(c);
    const { schoolId } = await c.call('registerSchool', schoolReq());
    expect(await c.claims()).toEqual({ schools: { [schoolId]: { r: 'a' } }, super: true });
  });

  it('stores only whitelisted school fields', async () => {
    const c = await signUp();
    const req = schoolReq({ logoUrl: 'https://evil.example/x.png', termsVersion: '0' });
    const school = { ...req.school, status: 'disabled', activeYearId: 'y1', createdAt: 1 } as typeof req.school;
    const { schoolId } = await c.call('registerSchool', { ...req, school });
    const doc = (await adminDb.doc(paths.school(schoolId)).get()).data()!;
    expect(doc.logoUrl).toBeUndefined();
    expect(doc.activeYearId).toBeUndefined();
    expect(doc).toMatchObject({ termsVersion: '1', status: 'pending', acceptedTerms: { version: '1' } });
    expect(doc.createdAt).toBeGreaterThan(1);
  });

  it('requires the current terms version from platform/config', async () => {
    const c = await signUp();
    const config = adminDb.doc(paths.platform.config);
    await config.set({ currentTermsVersion: '2026-03' });
    try {
      await expectFnError(c.call('registerSchool', schoolReq()), 'failed-precondition', 'terms-changed');
      const { schoolId } = await c.call('registerSchool', { ...schoolReq(), acceptedTermsVersion: '2026-03' });
      expect((await adminDb.doc(paths.school(schoolId)).get()).data()).toMatchObject({ termsVersion: '2026-03', acceptedTerms: { version: '2026-03' } });
    } finally {
      await config.delete();
    }
  });

  it('takes version 1 as current when platform/config has no terms version', async () => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', { ...schoolReq(), acceptedTermsVersion: '2' }), 'failed-precondition', 'terms-changed');
    await expect(c.call('registerSchool', schoolReq())).resolves.toMatchObject({ schoolId: expect.any(String) });
  });

  it('rejects invalid input', async () => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', schoolReq({ staffPrefix: 'scc1' })), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', schoolReq({ nameEn: '  ', nameSi: ' ' })), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', { ...schoolReq(), acceptedTermsVersion: '' }), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', schoolReq({ district: 'Moneragala' })), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', schoolReq({ district: 'kandy' })), 'invalid-argument', 'invalid');
  });

  it('requires a city', async () => {
    const c = await signUp();
    const { city: _, ...noCity } = schoolReq().school;
    await expectFnError(c.call('registerSchool', { ...schoolReq(), school: noCity as unknown as RegisterSchoolInput['school'] }), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', schoolReq({ city: '   ' })), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', schoolReq({ city: 'x'.repeat(81) })), 'invalid-argument', 'invalid');
  });

  it('stores trimmed city, address and phone', async () => {
    const c = await signUp();
    const { schoolId } = await c.call(
      'registerSchool',
      schoolReq({ city: '  Siripura ', address: ' 12 Temple Road, Siripura ', phone: ' 037 222 3344 ' }),
    );
    const doc = (await adminDb.doc(paths.school(schoolId)).get()).data()!;
    expect(doc).toMatchObject({ city: 'Siripura', address: '12 Temple Road, Siripura', phone: '037 222 3344' });
    await approve(schoolId);
    const dir = (await adminDb.doc(paths.directory(schoolId)).get()).data()!;
    expect(dir.city).toBe('Siripura');
    expect(dir.address).toBeUndefined();
    expect(dir.phone).toBeUndefined();
  });

  it('takes the school name in English, Sinhala or both, but not neither', async () => {
    const c = await signUp();
    const { schoolId } = await c.call('registerSchool', schoolReq({ nameEn: '', nameSi: 'සිරිපුර විද්‍යාලය' }));
    expect((await adminDb.doc(paths.school(schoolId)).get()).data()).toMatchObject({ nameEn: '', nameSi: 'සිරිපුර විද්‍යාලය' });
    await approve(schoolId);
    expect((await adminDb.doc(paths.directory(schoolId)).get()).data()).toMatchObject({ nameLower: 'සිරිපුර විද්‍යාලය' });
    const other = await signUp();
    await expectFnError(other.call('registerSchool', schoolReq({ nameEn: ' ', nameSi: '' })), 'invalid-argument', 'invalid');
  });

  it('accepts a school without address and phone', async () => {
    const c = await signUp();
    const { schoolId } = await c.call('registerSchool', schoolReq());
    const doc = (await adminDb.doc(paths.school(schoolId)).get()).data()!;
    expect(doc.address).toBeUndefined();
    expect(doc.phone).toBeUndefined();
  });

  it('rejects over-length or non-string address and phone', async () => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', schoolReq({ address: 'a'.repeat(201) })), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', schoolReq({ phone: '1'.repeat(31) })), 'invalid-argument', 'invalid');
    const bad = { ...schoolReq().school, phone: 37 } as unknown as RegisterSchoolInput['school'];
    await expectFnError(c.call('registerSchool', { ...schoolReq(), school: bad }), 'invalid-argument', 'invalid');
  });
});
