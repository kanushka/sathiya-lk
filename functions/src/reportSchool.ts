// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { REPORT_REASONS, type ReportReason, type ReportSchoolRes } from './lib/contract';
import { docId, email, fail, invalid, obj, optStr } from './lib/guards';
import { clientIp, consumeRateLimits, hashIp, REPORT_PER_IP_PER_DAY } from './lib/rateLimit';

export const REPORTS = 'reports';

// Open to signed-out callers (parents, public); limited per IP.
export const reportSchool = onCall(callOpts, async (req): Promise<ReportSchoolRes> => {
  await consumeRateLimits([{ scope: 'report-ip', id: hashIp(clientIp(req)), max: REPORT_PER_IP_PER_DAY }]);

  const data = obj(req.data, 'request');
  const schoolId = docId(data.schoolId, 'schoolId');
  const reason = data.reason as ReportReason;
  if (!REPORT_REASONS.includes(reason)) invalid(`reason must be one of ${REPORT_REASONS.join(', ')}`);
  const details = optStr(data.details, 'details', 1000);
  const from = data.email === undefined || data.email === null || data.email === '' ? undefined : email(data.email);
  if (!(await db.doc(paths.school(schoolId)).get()).exists) fail('not-found', 'invalid', 'Unknown school');

  await db.collection(REPORTS).add({
    schoolId,
    reason,
    details,
    email: from,
    uid: req.auth?.uid,
    status: 'open',
    createdAt: Date.now(),
  });
  return { ok: true };
});
