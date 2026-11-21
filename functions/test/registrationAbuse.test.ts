// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import type { RegisterSchoolReq as RegisterSchoolInput } from '@sathiya/core';
import { REGISTER_PER_IP_PER_DAY, REGISTER_PER_UID_PER_DAY } from '../src/lib/rateLimit';
import {
  adminAuth,
  adminDb,
  expectFnError,
  randomCensus,
  rawCall,
  rawErr,
  schoolReq,
  signInGoogle,
  signUp,
  uniq,
  unverifiedSignUp,
} from './helpers';

const census = (n: string) => adminDb.doc(`censusIndex/${n}`);
const badSchool = (s: Record<string, unknown>) => ({ ...schoolReq(), school: { ...schoolReq().school, ...s } }) as RegisterSchoolInput;

describe('registerSchool school type and census number', () => {
  it('requires a census number for a government school', async () => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', schoolReq({ type: 'government' })), 'invalid-argument', 'invalid');
    expect(await c.claims()).toEqual({ sid: undefined, role: undefined, tid: undefined });
  });

  it('requires a valid type', async () => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', badSchool({ type: 'public' })), 'invalid-argument', 'invalid');
    const { type: _, ...noType } = schoolReq().school;
    await expectFnError(c.call('registerSchool', { ...schoolReq(), school: noType as RegisterSchoolInput['school'] }), 'invalid-argument', 'invalid');
  });

  it.each(['abc', '123', '1234567', '12 34', '12a45', '', 12345])('rejects census number %j', async (n) => {
    const c = await signUp();
    await expectFnError(c.call('registerSchool', badSchool({ type: 'government', censusNo: n })), 'invalid-argument', 'invalid');
  });

  it('registers a government school, reserves the census number, keeps it off the directory', async () => {
    const c = await signUp();
    const n = randomCensus();
    const { schoolId } = await c.call('registerSchool', schoolReq({ type: 'government', censusNo: ` ${n} ` }));
    expect((await census(n).get()).data()).toEqual({ schoolId });
    expect((await adminDb.doc(paths.school(schoolId)).get()).data()).toMatchObject({ type: 'government', censusNo: n });
    const dir = (await adminDb.doc(paths.directory(schoolId)).get()).data()!;
    expect(dir.type).toBe('government');
    expect(dir.censusNo).toBeUndefined();
  });

  it('makes the census number optional for private and international schools', async () => {
    const a = await signUp();
    const { schoolId: s1 } = await a.call('registerSchool', schoolReq({ type: 'international' }));
    expect((await adminDb.doc(paths.school(s1)).get()).data()!.censusNo).toBeUndefined();

    const b = await signUp();
    const n = randomCensus();
    const { schoolId: s2 } = await b.call('registerSchool', schoolReq({ type: 'private', censusNo: n }));
    expect((await census(n).get()).data()).toEqual({ schoolId: s2 });
  });

  it('refuses a census number already taken and leaves no school or claims', async () => {
    const n = randomCensus();
    const a = await signUp();
    await a.call('registerSchool', schoolReq({ type: 'government', censusNo: n }));
    const b = await signUp();
    await expectFnError(b.call('registerSchool', schoolReq({ type: 'private', censusNo: n })), 'already-exists', 'census-taken');
    expect(await b.claims()).toEqual({ sid: undefined, role: undefined, tid: undefined });
    expect((await adminDb.doc(paths.user(b.uid)).get()).exists).toBe(false);
  });

  it('lets exactly one of two concurrent registrations with the same census number succeed', async () => {
    for (let round = 0; round < 3; round++) {
      const n = randomCensus();
      const [a, b] = await Promise.all([signUp(), signUp()]);
      const results = await Promise.allSettled(
        [a, b].map((x) => x.call('registerSchool', schoolReq({ type: 'government', censusNo: n }))),
      );
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect({ code: failed[0]!.reason.code, apiCode: failed[0]!.reason.details?.code }).toEqual({
        code: 'functions/already-exists',
        apiCode: 'census-taken',
      });
      const winner = (ok[0] as PromiseFulfilledResult<{ schoolId: string }>).value.schoolId;
      expect((await census(n).get()).data()).toEqual({ schoolId: winner });
      const loser = results[0]!.status === 'rejected' ? a : b;
      expect((await loser.claims()).sid).toBeUndefined();
    }
  });
});

describe('registerSchool verified email', () => {
  it('refuses an unverified email/password account', async () => {
    const c = await unverifiedSignUp();
    await expectFnError(c.call('registerSchool', schoolReq()), 'permission-denied', 'email-unverified');
  });

  it('accepts a Google account even if email_verified is false', async () => {
    const c = await signInGoogle(`g-${uniq()}@example.com`, false);
    await expect(c.call('registerSchool', schoolReq())).resolves.toMatchObject({ schoolId: expect.any(String) });
  });
});

describe('registerSchool one school per user', () => {
  it('writes users/{uid}.schoolId, merged with existing fields', async () => {
    const c = await signUp();
    await adminDb.doc(paths.user(c.uid)).set({ lang: 'si' });
    const { schoolId } = await c.call('registerSchool', schoolReq());
    expect((await adminDb.doc(paths.user(c.uid)).get()).data()).toEqual({ lang: 'si', schoolId });
  });

  it('refuses a user whose users doc already has a schoolId (no sid claim)', async () => {
    const c = await signUp();
    await adminDb.doc(paths.user(c.uid)).set({ schoolId: 'old-school' });
    await expectFnError(c.call('registerSchool', schoolReq()), 'failed-precondition', 'already-has-school');
    expect((await c.claims()).sid).toBeUndefined();
  });

  it('leaves the winner of a same-user double submit with its school claims', async () => {
    for (let round = 0; round < 3; round++) {
      const c = await signUp();
      const results = await Promise.allSettled([c.call('registerSchool', schoolReq()), c.call('registerSchool', schoolReq())]);
      const ok = results.filter((x): x is PromiseFulfilledResult<{ schoolId: string }> => x.status === 'fulfilled');
      expect(ok).toHaveLength(1);
      const failed = results.find((x): x is PromiseRejectedResult => x.status === 'rejected')!;
      expect(failed.reason.details?.code).toBe('already-has-school');
      const sid = ok[0]!.value.schoolId;
      expect((await adminDb.doc(paths.user(c.uid)).get()).data()!.schoolId).toBe(sid);
      expect(await c.claims()).toEqual({ sid, role: 'admin', tid: undefined });
    }
  });

  it('refuses a user with a sid claim but no users doc', async () => {
    const c = await signUp();
    await adminAuth.setCustomUserClaims(c.uid, { sid: 'other', role: 'teacher', tid: 't1' });
    await c.auth.currentUser!.getIdToken(true);
    await expectFnError(c.call('registerSchool', schoolReq()), 'failed-precondition', 'already-has-school');
  });
});

describe('registerSchool rate limits', () => {
  it(`refuses attempt ${REGISTER_PER_UID_PER_DAY + 1} by the same user on the same day (failed attempts count)`, async () => {
    expect(REGISTER_PER_UID_PER_DAY).toBe(3);
    const c = await signUp();
    for (let i = 0; i < REGISTER_PER_UID_PER_DAY; i++) {
      await expectFnError(c.call('registerSchool', schoolReq({ nameEn: ' ' })), 'invalid-argument', 'invalid');
    }
    await expectFnError(c.call('registerSchool', schoolReq()), 'resource-exhausted', 'rate-limited');
    expect((await c.claims()).sid).toBeUndefined();
  });

  it('counts per user across IPs', async () => {
    const c = await signUp();
    for (let i = 0; i < REGISTER_PER_UID_PER_DAY; i++) {
      const r = await rawCall('registerSchool', badSchool({ nameEn: ' ' }), { client: c, ip: `198.51.100.${i + 1}` });
      expect(rawErr(r)).toEqual({ status: 'INVALID_ARGUMENT', code: 'invalid' });
    }
    const r = await rawCall('registerSchool', schoolReq(), { client: c, ip: '198.51.100.99' });
    expect(rawErr(r)).toEqual({ status: 'RESOURCE_EXHAUSTED', code: 'rate-limited' });
  });

  it(`refuses attempt ${REGISTER_PER_IP_PER_DAY + 1} from the same IP (rightmost X-Forwarded-For hop)`, async () => {
    expect(REGISTER_PER_IP_PER_DAY).toBe(10);
    const ip = '203.0.113.7';
    const users = await Promise.all(Array.from({ length: REGISTER_PER_IP_PER_DAY + 1 }, () => signUp()));
    for (const u of users.slice(0, REGISTER_PER_IP_PER_DAY)) {
      const r = await rawCall('registerSchool', badSchool({ nameEn: ' ' }), { client: u, ip });
      expect(rawErr(r)).toEqual({ status: 'INVALID_ARGUMENT', code: 'invalid' });
    }
    const last = users[REGISTER_PER_IP_PER_DAY]!;
    expect(rawErr(await rawCall('registerSchool', schoolReq(), { client: last, ip }))).toEqual({
      status: 'RESOURCE_EXHAUSTED',
      code: 'rate-limited',
    });
    const other = await rawCall('registerSchool', schoolReq(), { client: last, ip: '203.0.113.8' });
    expect(other.error).toBeUndefined();
    expect(other.result).toMatchObject({ schoolId: expect.any(String) });
  });

  it('ignores a spoofed client-supplied X-Forwarded-For hop', async () => {
    const ip = '203.0.113.20';
    const users = await Promise.all(Array.from({ length: REGISTER_PER_IP_PER_DAY + 1 }, () => signUp()));
    for (const [i, u] of users.slice(0, REGISTER_PER_IP_PER_DAY).entries()) {
      const r = await rawCall('registerSchool', badSchool({ nameEn: ' ' }), { client: u, ip, spoof: `10.9.8.${i}` });
      expect(rawErr(r)).toEqual({ status: 'INVALID_ARGUMENT', code: 'invalid' });
    }
    const r = await rawCall('registerSchool', schoolReq(), { client: users[REGISTER_PER_IP_PER_DAY]!, ip, spoof: '10.9.8.200' });
    expect(rawErr(r)).toEqual({ status: 'RESOURCE_EXHAUSTED', code: 'rate-limited' });
    const ipKeys = (await adminDb.collection('rateLimits').get()).docs.filter((d) => d.id.startsWith('register-ip_'));
    expect(ipKeys).toHaveLength(1);
  });

  it('stores counters under hashed IP keys with an expiry', async () => {
    const c = await signUp();
    await rawCall('registerSchool', schoolReq(), { client: c, ip: '192.0.2.44' });
    const docs = (await adminDb.collection('rateLimits').get()).docs;
    const day = new Date().toISOString().slice(0, 10);
    const ids = docs.map((d) => d.id).sort();
    expect(ids).toContain(`register-uid_${day}_${c.uid}`);
    const ipKey = ids.find((id) => id.startsWith(`register-ip_${day}_`))!;
    expect(ipKey).toMatch(/_[0-9a-f]{64}$/);
    expect(ipKey).not.toContain('192.0.2.44');
    const data = docs.find((d) => d.id === ipKey)!.data();
    expect(data.count).toBe(1);
    expect(data.expiresAt.toMillis()).toBeGreaterThan(Date.now());
  });
});
