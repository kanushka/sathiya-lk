// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type RequestNameChangeRes, type SchoolNameChange } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { mailConfig } from './email/params';
import { sendMail } from './email/send';
import { nameChangeRequested } from './email/templates';
import { callOpts } from './lib/callOptions';
import { invalid, obj, requireSchoolAdmin, twoNames } from './lib/guards';
import { moeSchool } from './lib/moe';
import { consumeRateLimits, NAME_CHANGE_PER_SCHOOL_PER_DAY } from './lib/rateLimit';
import { runTx } from './lib/tx';

const same = (a: string | undefined, b: string | undefined) => (a ?? '') === (b ?? '');

export const requestNameChange = onCall(callOpts, async (req): Promise<RequestNameChangeRes> => {
  const data = obj(req.data, 'request');
  const { sid, uid, token } = await requireSchoolAdmin(req, data.schoolId);
  const { en: nameEn, si: nameSi } = twoNames(data.nameEn, data.nameSi, 'nameEn', 'nameSi');
  await consumeRateLimits([{ scope: 'name-change-school', id: sid, max: NAME_CHANGE_PER_SCHOOL_PER_DAY }]);
  const schoolRef = db.doc(paths.school(sid));
  const result = await runTx(async (tx) => {
    const snap = await tx.get(schoolRef);
    const current = { nameEn: (snap.get('nameEn') as string | undefined) ?? '', nameSi: snap.get('nameSi') as string | undefined };
    if (same(nameEn, current.nameEn) && same(nameSi, current.nameSi)) invalid('The new name is the same as the current name');
    const prev = snap.get('nameChange') as SchoolNameChange | undefined;
    if (prev?.status === 'pending' && same(prev.nameEn, nameEn) && same(prev.nameSi, nameSi)) return undefined;
    const censusNo = snap.get('censusNo') as string | undefined;
    const moeName = censusNo ? moeSchool(censusNo)?.name : undefined;
    const change: SchoolNameChange = { nameEn, nameSi, moeName, status: 'pending', requestedAt: Date.now(), requestedBy: uid };
    tx.update(schoolRef, { nameChange: change });
    return { current, censusNo, moeName };
  });
  if (!result) return { ok: true };
  await sendMail('nameChangeRequested', async () => {
    const { appUrl, webUrl, superEmails } = mailConfig();
    if (!superEmails.length) return undefined;
    const member = await db.doc(`${paths.members(sid)}/${uid}`).get();
    const message = nameChangeRequested({
      schoolId: sid,
      censusNo: result.censusNo,
      moeName: result.moeName,
      current: result.current,
      requested: { nameEn, nameSi },
      requester: { name: member.get('name') as string | undefined, email: token.email?.toLowerCase() },
      schoolUrl: `${appUrl}/super/schools/${sid}`,
      webUrl,
    });
    return { to: superEmails, message };
  });
  return { ok: true };
});
