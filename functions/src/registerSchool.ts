// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { CENSUS_NO_RE, paths, SCHOOL_TYPES, type PeriodTemplate, type RegisterSchoolRes, type SchoolType } from '@sathiya/core';
import { defaultTemplate } from '@sathiya/core/fixtures';
import { logger } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { mailConfig } from './email/params';
import { sendMail } from './email/send';
import { schoolRegistered } from './email/templates';
import { callOpts } from './lib/callOptions';
import { setSchoolClaims } from './lib/claims';
import { directoryFields } from './lib/directory';
import { fail, intList, invalid, isVerified, obj, optStr, requireAuth, str, twoNames } from './lib/guards';
import { clientIp, consumeRateLimits, hashIp, REGISTER_PER_IP_PER_DAY, REGISTER_PER_UID_PER_DAY } from './lib/rateLimit';
import { runTx } from './lib/tx';


const HEX = /^#[0-9A-Fa-f]{6}$/;
export const CENSUS_INDEX = 'censusIndex';

const alreadyHasSchool = (): never => fail('failed-precondition', 'already-has-school', 'Already a member of a school');

// After a failed attempt: undo this attempt's claims; then, if another attempt by the same user won (users/{uid}.schoolId)
// and the user is that school's admin member, give the user its claims. Restoring before reading means a winner that
// committed before the read is never left without claims (the winner also re-asserts after its commit).
async function reconcileClaims(uid: string, sid: string, prevClaims: Record<string, unknown> | null): Promise<void> {
  if ((await auth.getUser(uid)).customClaims?.sid === sid) await auth.setCustomUserClaims(uid, prevClaims);
  const winner = (await db.doc(paths.user(uid)).get()).get('schoolId') as string | undefined;
  if (!winner || winner === sid) return;
  const member = await db.doc(`${paths.members(winner)}/${uid}`).get();
  if (member.get('role') === 'admin') await setSchoolClaims(uid, { sid: winner, role: 'admin' });
}

export const registerSchool = onCall(callOpts, async (req): Promise<RegisterSchoolRes> => {
  const { uid, claims, token } = requireAuth(req);
  if (!isVerified(token)) fail('permission-denied', 'email-unverified', 'Verify your email address first');
  await consumeRateLimits([
    { scope: 'register-uid', id: uid, max: REGISTER_PER_UID_PER_DAY },
    { scope: 'register-ip', id: hashIp(clientIp(req)), max: REGISTER_PER_IP_PER_DAY },
  ]);
  const prevClaims = (await auth.getUser(uid)).customClaims ?? null;
  if (claims.sid || prevClaims?.sid) alreadyHasSchool();

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
  const { en: nameEn, si: nameSi } = twoNames(s.nameEn, s.nameSi, 'nameEn', 'nameSi');
  const district = str(s.district, 'district', 60);
  const city = str(s.city, 'city', 80);
  const address = optStr(s.address, 'address', 200);
  const phone = optStr(s.phone, 'phone', 30);
  const type = s.type as SchoolType;
  if (!SCHOOL_TYPES.includes(type)) invalid(`type must be one of ${SCHOOL_TYPES.join(', ')}`);
  const censusNo = optStr(s.censusNo, 'censusNo', 10);
  if (censusNo !== undefined && !CENSUS_NO_RE.test(censusNo)) invalid('censusNo must be 4–6 digits');
  if (type === 'government' && !censusNo) invalid('censusNo is required for a government school');

  const now = Date.now();
  const schoolRef = db.doc(paths.school('_')).parent.doc();
  const sid = schoolRef.id;
  const template: Omit<PeriodTemplate, 'id'> = { name: defaultTemplate.name, isDefault: true, mode: 'same', rows: defaultTemplate.rows };

  const userRef = db.doc(paths.user(uid));
  const censusRef = censusNo ? db.collection(CENSUS_INDEX).doc(censusNo) : undefined;

  // Claims first, rolled back if the transaction fails, so neither an orphan school nor a dangling sid claim is left.
  await setSchoolClaims(uid, { sid, role: 'admin' });
  try {
    await runTx(async (tx) => {
      const [user, census] = await tx.getAll(userRef, ...(censusRef ? [censusRef] : []));
      if (user!.get('schoolId')) alreadyHasSchool();
      if (census?.exists) fail('already-exists', 'census-taken', 'This census number is already registered');
      tx.create(schoolRef, {
        nameEn,
        nameSi,
        district,
        city,
        address,
        phone,
        type,
        censusNo,
        grades,
        staffPrefix,
        colors: { primary, second },
        status: 'active',
        termsVersion,
        acceptedTerms: { version: termsVersion, at: now, uid },
        createdAt: now,
      });
      tx.create(db.doc(paths.directory(sid)), directoryFields({ nameEn, nameSi, district, city, type, status: 'active' }));
      tx.create(db.doc(`${paths.members(sid)}/${uid}`), { uid, role: 'admin', email: token.email?.toLowerCase(), name: adminName });
      tx.create(db.collection(paths.templates(sid)).doc(), template);
      if (censusRef) tx.create(censusRef, { schoolId: sid });
      tx.set(userRef, { schoolId: sid }, { merge: true });
    });
  } catch (e) {
    await reconcileClaims(uid, sid, prevClaims).catch(() => undefined);
    // A lost race on the census reservation surfaces as ALREADY_EXISTS from commit (school/member/template ids are fresh).
    if ((e as { code?: unknown }).code === 6 && censusRef) fail('already-exists', 'census-taken', 'This census number is already registered');
    throw e;
  }
  // Re-assert after commit: a concurrent losing attempt by the same user may have restored the old claims meanwhile.
  await setSchoolClaims(uid, { sid, role: 'admin' }).catch((e) => logger.error('registerSchool: claims re-assert failed', { sid, e }));
  await sendMail('schoolRegistered', async () => {
    const { appUrl, webUrl } = mailConfig();
    const to = token.email?.toLowerCase();
    if (!to) return undefined;
    const school = { nameEn, nameSi, colors: { primary } };
    return { to: [to], message: schoolRegistered({ adminName, school, loginUrl: `${appUrl}/login`, webUrl }) };
  });
  return { schoolId: sid };
});
