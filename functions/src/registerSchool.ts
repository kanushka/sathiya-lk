// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type PeriodTemplate, type RegisterSchoolReq, type RegisterSchoolRes } from '@sathiya/core';
import { defaultTemplate } from '@sathiya/core/fixtures';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { setSchoolClaims } from './lib/claims';
import { intList, invalid, notAllowed, obj, optStr, requireAuth, str } from './lib/guards';

const HEX = /^#[0-9A-Fa-f]{6}$/;

// city/address/phone are not in @sathiya/core yet (added on another branch).
export type RegisterSchoolInput = Omit<RegisterSchoolReq, 'school'> & {
  school: RegisterSchoolReq['school'] & { city: string; address?: string; phone?: string };
};

export const registerSchool = onCall(callOpts, async (req): Promise<RegisterSchoolRes> => {
  const { uid, claims, token } = requireAuth(req);
  const prevClaims = (await auth.getUser(uid)).customClaims ?? null;
  if (claims.sid || prevClaims?.sid) notAllowed('Already a member of a school');

  const data = obj(req.data, 'request');
  const s = obj(data.school, 'school');
  const termsVersion = str(data.acceptedTermsVersion, 'acceptedTermsVersion', 40);
  const adminName = str(data.adminName, 'adminName');
  const staffPrefix = str(s.staffPrefix, 'staffPrefix', 5);
  if (!/^[A-Z]{2,5}$/.test(staffPrefix)) invalid('staffPrefix must be 2–5 capital letters');
  const colors = obj(s.colors, 'colors');
  const primary = str(colors.primary, 'colors.primary', 7);
  const second = str(colors.second, 'colors.second', 7);
  if (!HEX.test(primary) || !HEX.test(second)) invalid('colors must be #RRGGBB');
  const grades = intList(s.grades, 'grades', 1, 13);
  if (!grades.length) invalid('grades is required');
  const nameEn = str(s.nameEn, 'nameEn');
  const nameSi = optStr(s.nameSi, 'nameSi');
  const district = str(s.district, 'district', 60);
  const city = str(s.city, 'city', 80);
  const address = optStr(s.address, 'address', 200);
  const phone = optStr(s.phone, 'phone', 30);

  const now = Date.now();
  const schoolRef = db.doc(paths.school('_')).parent.doc();
  const sid = schoolRef.id;
  const template: Omit<PeriodTemplate, 'id'> = { name: defaultTemplate.name, isDefault: true, mode: 'same', rows: defaultTemplate.rows };

  // Claims first, rolled back if the batch fails, so neither an orphan school nor a dangling sid claim is left.
  await setSchoolClaims(uid, { sid, role: 'admin' });
  const batch = db.batch();
  batch.create(schoolRef, {
    nameEn,
    nameSi,
    district,
    city,
    address,
    phone,
    grades,
    staffPrefix,
    colors: { primary, second },
    status: 'active',
    termsVersion,
    acceptedTerms: { version: termsVersion, at: now, uid },
    createdAt: now,
  });
  batch.create(db.doc(paths.directory(sid)), { nameEn, nameSi, district, city, status: 'active' });
  batch.create(db.doc(`${paths.members(sid)}/${uid}`), { uid, role: 'admin', email: token.email?.toLowerCase(), name: adminName });
  batch.create(db.collection(paths.templates(sid)).doc(), template);
  try {
    await batch.commit();
  } catch (e) {
    await auth.setCustomUserClaims(uid, prevClaims).catch(() => undefined);
    throw e;
  }
  return { schoolId: sid };
});
