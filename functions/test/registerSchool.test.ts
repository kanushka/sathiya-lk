// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { callables, paths, type PeriodTemplate } from '@sathiya/core';
import { defaultTemplate } from '@sathiya/core/fixtures';
import { httpsCallable } from 'firebase/functions';
import { describe, expect, it } from 'vitest';
import type { RegisterSchoolReq as RegisterSchoolInput } from '@sathiya/core';
import { adminDb, client, expectFnError, makeSuper, schoolReq, signUp } from './helpers';

describe('unauthenticated', () => {
  it.each(Object.keys(callables).filter((n) => !['saveEntry', 'deleteEntry', 'publishYear', 'deleteSetupItem', 'reportSchool', 'sendAuthEmail'].includes(n)))(
    '%s refuses a signed-out caller',
    async (name) => {
      const c = client();
      await expectFnError(httpsCallable(c.functions, name)({ schoolId: 'x' }), 'unauthenticated', 'not-allowed');
    },
  );
});

describe('registerSchool', () => {
  it('creates school, directory, admin member, default template and sets claims', async () => {
    const c = await signUp();
    const before = Date.now();
    const { schoolId } = await c.call('registerSchool', schoolReq());
    expect(schoolId).toMatch(/^[A-Za-z0-9]{20}$/);

    expect(await c.claims()).toEqual({ sid: schoolId, role: 'admin', tid: undefined });

    const school = (await adminDb.doc(paths.school(schoolId)).get()).data()!;
    expect(school).toMatchObject({
      nameEn: 'Siripura Central College',
      district: 'Kurunegala',
      city: 'Siripura',
      staffPrefix: 'SCC',
      type: 'private',
      status: 'active',
      termsVersion: '1',
      acceptedTerms: { version: '1' },
    });
    expect(school.createdAt).toBeGreaterThanOrEqual(before);
    expect(school.acceptedTerms.at).toBeGreaterThanOrEqual(before);

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

  it('refuses a caller that already has a school (sid claim)', async () => {
    const c = await signUp();
    await c.call('registerSchool', schoolReq());
    await c.auth.currentUser!.getIdToken(true);
    await expectFnError(c.call('registerSchool', schoolReq()), 'failed-precondition', 'already-has-school');
  });

  it('keeps an existing super flag', async () => {
    const c = await signUp();
    await makeSuper(c);
    const { schoolId } = await c.call('registerSchool', schoolReq());
    expect(await c.claims()).toEqual({ sid: schoolId, role: 'admin', tid: undefined, super: true });
  });

  it('stores only whitelisted school fields', async () => {
    const c = await signUp();
    const req = schoolReq({ logoUrl: 'https://evil.example/x.png', termsVersion: '0' });
    const school = { ...req.school, status: 'disabled', activeYearId: 'y1', createdAt: 1 } as typeof req.school;
    const { schoolId } = await c.call('registerSchool', { ...req, school, acceptedTermsVersion: '2' });
    const doc = (await adminDb.doc(paths.school(schoolId)).get()).data()!;
    expect(doc.logoUrl).toBeUndefined();
    expect(doc.activeYearId).toBeUndefined();
    expect(doc).toMatchObject({ termsVersion: '2', status: 'active', acceptedTerms: { version: '2' } });
    expect(doc.createdAt).toBeGreaterThan(1);
  });

  it('rejects invalid input', async () => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', schoolReq({ staffPrefix: 'scc1' })), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', schoolReq({ nameEn: '  ' })), 'invalid-argument', 'invalid');
    await expectFnError(c.call('registerSchool', { ...schoolReq(), acceptedTermsVersion: '' }), 'invalid-argument', 'invalid');
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
    const dir = (await adminDb.doc(paths.directory(schoolId)).get()).data()!;
    expect(dir.city).toBe('Siripura');
    expect(dir.address).toBeUndefined();
    expect(dir.phone).toBeUndefined();
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
