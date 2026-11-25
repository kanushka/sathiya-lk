// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { CENSUS_NO_RE, padCensusNo, type LookupCensusRes } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { callOpts } from './lib/callOptions';
import { censusTaken } from './lib/census';
import { invalid, obj, str } from './lib/guards';
import { moeSchool } from './lib/moe';
import { CHECK_CENSUS_PER_IP_PER_DAY, clientIp, consumeRateLimits, hashIp } from './lib/rateLimit';

// Open to signed-out callers (registration step 1). Shares checkCensusNo's per-IP budget.
export const lookupCensus = onCall(callOpts, async (req): Promise<LookupCensusRes> => {
  const censusNo = str(obj(req.data, 'request').censusNo, 'censusNo', 10);
  if (!CENSUS_NO_RE.test(censusNo)) invalid('censusNo must be 4–6 digits');
  await consumeRateLimits([{ scope: 'census-ip', id: hashIp(clientIp(req)), max: CHECK_CENSUS_PER_IP_PER_DAY }]);
  if (await censusTaken(censusNo)) return { status: 'registered' };
  const school = moeSchool(padCensusNo(censusNo));
  return school ? { status: 'listed', school } : { status: 'unlisted' };
});
