import { paths, type PeriodTemplate, type RegisterSchoolRes } from '@sathiya/core';
import { defaultTemplate } from '@sathiya/core/fixtures';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { setSchoolClaims } from './lib/claims';
import { intList, invalid, notAllowed, obj, optStr, requireAuth, str } from './lib/guards';

const HEX = /^#[0-9A-Fa-f]{6}$/;

export const registerSchool = onCall(callOpts, async (req): Promise<RegisterSchoolRes> => {
  const { uid, claims, token } = requireAuth(req);
  if (claims.sid || (await auth.getUser(uid)).customClaims?.sid) notAllowed('Already a member of a school');

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

  const now = Date.now();
  const schoolRef = db.doc(paths.school('_')).parent.doc();
  const sid = schoolRef.id;
  const template: Omit<PeriodTemplate, 'id'> = { name: defaultTemplate.name, isDefault: true, mode: 'same', rows: defaultTemplate.rows };

  const batch = db.batch();
  batch.create(schoolRef, {
    nameEn,
    nameSi,
    district,
    grades,
    staffPrefix,
    colors: { primary, second },
    status: 'active',
    termsVersion,
    acceptedTerms: { version: termsVersion, at: now, uid },
    createdAt: now,
  });
  batch.create(db.doc(paths.directory(sid)), { nameEn, nameSi, district, status: 'active' });
  batch.create(db.doc(`${paths.members(sid)}/${uid}`), { uid, role: 'admin', email: token.email?.toLowerCase(), name: adminName });
  batch.create(db.collection(paths.templates(sid)).doc(), template);
  await batch.commit();

  await setSchoolClaims(uid, { sid, role: 'admin' });
  return { schoolId: sid };
});
