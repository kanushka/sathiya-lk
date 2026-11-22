// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { CHECK_CENSUS_PER_IP_PER_DAY } from '../src/lib/rateLimit';
import { client, expectFnError, randomCensus, rawCall, rawErr, schoolReq, signUp } from './helpers';

describe('checkCensusNo', () => {
  it('reports availability to a signed-out caller and flips after registration', async () => {
    const censusNo = randomCensus();
    await expect(client().call('checkCensusNo', { censusNo })).resolves.toEqual({ available: true });
    const admin = await signUp();
    await admin.call('registerSchool', schoolReq({ type: 'government', censusNo }));
    await expect(client().call('checkCensusNo', { censusNo })).resolves.toEqual({ available: false });
  });

  it('rejects a malformed census number', async () => {
    await expectFnError(client().call('checkCensusNo', { censusNo: '12a' }), 'invalid-argument', 'invalid');
    await expectFnError(client().call('checkCensusNo', {} as never), 'invalid-argument', 'invalid');
  });

  it(`refuses check ${CHECK_CENSUS_PER_IP_PER_DAY + 1} from the same IP`, async () => {
    const ip = '203.0.113.80';
    for (let i = 0; i < CHECK_CENSUS_PER_IP_PER_DAY; i++) {
      expect((await rawCall('checkCensusNo', { censusNo: '654321' }, { ip })).result).toEqual({ available: true });
    }
    expect(rawErr(await rawCall('checkCensusNo', { censusNo: '654321' }, { ip }))).toEqual({ status: 'RESOURCE_EXHAUSTED', code: 'rate-limited' });
  });

  it('does not count malformed requests toward the limit', async () => {
    const ip = '203.0.113.81';
    for (let i = 0; i < CHECK_CENSUS_PER_IP_PER_DAY; i++) {
      expect(rawErr(await rawCall('checkCensusNo', { censusNo: '12a' }, { ip }))).toMatchObject({ code: 'invalid' });
    }
    expect((await rawCall('checkCensusNo', { censusNo: '654321' }, { ip })).result).toEqual({ available: true });
  });
});
