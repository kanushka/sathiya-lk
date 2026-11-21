// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { httpsCallable } from 'firebase/functions';
import { describe, expect, it } from 'vitest';
import type { ReportSchoolReq, ReportSchoolRes } from '@sathiya/core';
import { REPORT_PER_IP_PER_DAY } from '../src/lib/rateLimit';
import { adminDb, adminWithSchool, client, expectFnError, rawCall, rawErr, signUp, type Client } from './helpers';

const report = async (c: Client, req: Partial<Record<keyof ReportSchoolReq, unknown>>) =>
  (await httpsCallable<unknown, ReportSchoolRes>(c.functions, 'reportSchool')(req)).data;

const reportsFor = async (schoolId: string) =>
  (await adminDb.collection('reports').where('schoolId', '==', schoolId).get()).docs.map((d) => d.data());

describe('reportSchool', () => {
  it('accepts a report from a signed-out caller', async () => {
    const { sid } = await adminWithSchool();
    const before = Date.now();
    await expect(
      report(client(), { schoolId: sid, reason: 'fake', details: ' Not a real school ', email: 'Parent@Example.com' }),
    ).resolves.toEqual({ ok: true });
    const docs = await reportsFor(sid);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toEqual({
      schoolId: sid,
      reason: 'fake',
      details: 'Not a real school',
      email: 'parent@example.com',
      status: 'open',
      createdAt: expect.any(Number),
    });
    expect(docs[0]!.createdAt).toBeGreaterThanOrEqual(before);
  });

  it('records the uid of a signed-in caller and needs only schoolId and reason', async () => {
    const { sid } = await adminWithSchool();
    const c = await signUp();
    await expect(report(c, { schoolId: sid, reason: 'duplicate' })).resolves.toEqual({ ok: true });
    const [doc] = await reportsFor(sid);
    expect(doc).toEqual({ schoolId: sid, reason: 'duplicate', uid: c.uid, status: 'open', createdAt: expect.any(Number) });
  });

  it('rejects invalid input', async () => {
    const { sid } = await adminWithSchool();
    const c = client();
    await expectFnError(report(c, { schoolId: 'no-such-school', reason: 'fake' }), 'not-found', 'invalid');
    await expectFnError(report(c, { schoolId: sid, reason: 'spam' }), 'invalid-argument', 'invalid');
    await expectFnError(report(c, { schoolId: sid }), 'invalid-argument', 'invalid');
    await expectFnError(report(c, { schoolId: sid, reason: 'other', details: 'x'.repeat(1001) }), 'invalid-argument', 'invalid');
    await expectFnError(report(c, { schoolId: sid, reason: 'other', email: 'not-an-email' }), 'invalid-argument', 'invalid');
    await expectFnError(report(c, { reason: 'other' }), 'invalid-argument', 'invalid');
    expect(await reportsFor(sid)).toHaveLength(0);
  });

  it(`refuses report ${REPORT_PER_IP_PER_DAY + 1} from the same IP`, async () => {
    expect(REPORT_PER_IP_PER_DAY).toBe(10);
    const { sid } = await adminWithSchool();
    const ip = '203.0.113.50';
    for (let i = 0; i < REPORT_PER_IP_PER_DAY; i++) {
      const r = await rawCall('reportSchool', { schoolId: sid, reason: 'abuse' }, { ip });
      expect(r.result).toEqual({ ok: true });
    }
    expect(rawErr(await rawCall('reportSchool', { schoolId: sid, reason: 'abuse' }, { ip }))).toEqual({
      status: 'RESOURCE_EXHAUSTED',
      code: 'rate-limited',
    });
    expect((await rawCall('reportSchool', { schoolId: sid, reason: 'abuse' }, { ip: '203.0.113.51' })).result).toEqual({ ok: true });
    expect(await reportsFor(sid)).toHaveLength(REPORT_PER_IP_PER_DAY + 1);
  });
});
