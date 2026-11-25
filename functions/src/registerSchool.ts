// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  CENSUS_NO_RE,
  paths,
  SCHOOL_TYPES,
  similarSchools,
  titleCase,
  type MoeLang,
  type MoeSchool,
  type PeriodTemplate,
  type RegisterSchoolRes,
  type SchoolStatus,
  type SchoolType,
} from '@sathiya/core';
import { defaultTemplate } from '@sathiya/core/fixtures';
import { logger } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './lib/admin';
import { mailConfig } from './email/params';
import { sendMail } from './email/send';
import { schoolListed, schoolPendingReview, schoolRegistered, type DuplicateRow, type NewSchoolDetails, type SchoolPendingInput } from './email/templates';
import { callOpts } from './lib/callOptions';
import { assertSchoolRoom, syncClaims } from './lib/claims';
import { directoryFields } from './lib/directory';
import { fail, intList, invalid, isVerified, obj, optStr, requireAuth, str, twoNames } from './lib/guards';
import { moeNames, moeSchool } from './lib/moe';
import { clientIp, consumeRateLimits, hashIp, REGISTER_PER_IP_PER_DAY, REGISTER_PER_UID_PER_DAY } from './lib/rateLimit';
import { runTx } from './lib/tx';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const MEDIA = ['si', 'en', 'ta'] as const;
export const CENSUS_INDEX = 'censusIndex';

const censusTaken = (): never => fail('already-exists', 'school-registered', 'This school is already registered');

interface Details {
  nameEn: string;
  nameSi?: string;
  district: string;
  address?: string;
  type: SchoolType;
  grades: number[];
  medium?: MoeLang[];
}

function gradeList(v: unknown): number[] {
  const grades = intList(v, 'grades', 1, 13);
  if (!grades.length) invalid('grades is required');
  return grades;
}

function mediumList(v: unknown): MoeLang[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || !v.every((m) => (MEDIA as readonly unknown[]).includes(m))) invalid(`medium must be a list of ${MEDIA.join(', ')}`);
  const out = [...new Set(v as MoeLang[])];
  return out.length ? out : undefined;
}

// The MOE list is the source of truth for a listed census number: client name, address, level, district, grades and medium are ignored.
function listedDetails(moe: MoeSchool, s: Record<string, unknown>): Details {
  return {
    nameEn: moe.name,
    nameSi: optStr(s.nameSi, 'nameSi'),
    district: moe.district ?? str(s.district, 'district', 60),
    address: moe.address ? titleCase(moe.address) : undefined,
    type: 'government',
    grades: moe.grades.length ? moe.grades : gradeList(s.grades),
    medium: moe.media.length ? moe.media : undefined,
  };
}

function unlistedDetails(s: Record<string, unknown>, censusNo: string | undefined): Details {
  const { en: nameEn, si: nameSi } = twoNames(s.nameEn, s.nameSi, 'nameEn', 'nameSi');
  const type = s.type as SchoolType;
  if (!SCHOOL_TYPES.includes(type)) invalid(`type must be one of ${SCHOOL_TYPES.join(', ')}`);
  if (type === 'government' && !censusNo) invalid('censusNo is required for a government school');
  return {
    nameEn,
    nameSi,
    district: str(s.district, 'district', 60),
    address: optStr(s.address, 'address', 200),
    type,
    grades: gradeList(s.grades),
    medium: mediumList(s.medium),
  };
}

const SAME_DISTRICT_MAX = 10;

async function possibleDuplicates(sid: string, name: string, district: string): Promise<Pick<SchoolPendingInput, 'similarRegistered' | 'similarMoe' | 'sameDistrict'>> {
  const snap = await db.doc(paths.school(sid)).parent.select('nameEn', 'nameSi', 'district', 'city', 'status').get();
  const registered: DuplicateRow[] = snap.docs
    .filter((d) => d.id !== sid)
    .map((d) => ({
      id: d.id,
      name: (d.get('nameEn') as string | undefined) || (d.get('nameSi') as string | undefined) || d.id,
      district: d.get('district') as string | undefined,
      city: d.get('city') as string | undefined,
      status: d.get('status') as string | undefined,
    }));
  const byId = new Map(registered.map((r) => [r.id, r]));
  const key = district.trim().toLowerCase();
  return {
    similarRegistered: similarSchools(name, registered, 5).map((m) => byId.get(m.id)!),
    similarMoe: similarSchools(name, moeNames(), 5).map((m) => ({ id: m.id, name: m.name, district: moeSchool(m.id)?.district })),
    sameDistrict: registered.filter((r) => r.district?.trim().toLowerCase() === key).slice(0, SAME_DISTRICT_MAX),
  };
}

export const registerSchool = onCall(callOpts, async (req): Promise<RegisterSchoolRes> => {
  const { uid, token } = requireAuth(req);
  if (!isVerified(token)) fail('permission-denied', 'email-unverified', 'Verify your email address first');
  await consumeRateLimits([
    { scope: 'register-uid', id: uid, max: REGISTER_PER_UID_PER_DAY },
    { scope: 'register-ip', id: hashIp(clientIp(req)), max: REGISTER_PER_IP_PER_DAY },
  ]);

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
  const city = str(s.city, 'city', 80);
  const phone = optStr(s.phone, 'phone', 30);
  const censusNo = optStr(s.censusNo, 'censusNo', 10);
  if (censusNo !== undefined && !CENSUS_NO_RE.test(censusNo)) invalid('censusNo must be 4–6 digits');
  const moe = censusNo ? moeSchool(censusNo) : undefined;
  const details = moe ? listedDetails(moe, s) : unlistedDetails(s, censusNo);
  const { nameEn, nameSi, district, address, type, grades, medium } = details;

  const currentTerms = (await db.doc(paths.platform.config).get()).get('currentTermsVersion');
  if (typeof currentTerms !== 'string' || termsVersion !== currentTerms) invalid('Accept the current terms first');

  const status: SchoolStatus = moe ? 'active' : 'pending';
  const now = Date.now();
  const schoolRef = db.doc(paths.school('_')).parent.doc();
  const sid = schoolRef.id;
  const template: Omit<PeriodTemplate, 'id'> = { name: defaultTemplate.name, isDefault: true, mode: 'same', rows: defaultTemplate.rows };

  const censusRef = censusNo ? db.collection(CENSUS_INDEX).doc(censusNo) : undefined;

  await assertSchoolRoom(uid, sid);
  try {
    await runTx(async (tx) => {
      if (censusRef && (await tx.get(censusRef)).exists) censusTaken();
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
        medium,
        staffPrefix,
        colors: { primary, second },
        status,
        review: { moeMatched: !!moe },
        termsVersion,
        acceptedTerms: { version: termsVersion, at: now, uid },
        createdAt: now,
      });
      if (status === 'active') tx.create(db.doc(paths.directory(sid)), directoryFields({ nameEn, nameSi, district, city, type, status }));
      tx.create(db.doc(`${paths.members(sid)}/${uid}`), { uid, role: 'admin', email: token.email?.toLowerCase(), name: adminName });
      tx.create(db.collection(paths.templates(sid)).doc(), template);
      if (censusRef) tx.create(censusRef, { schoolId: sid });
    });
  } catch (e) {
    // A lost race on the census reservation surfaces as ALREADY_EXISTS from commit (school/member/template ids are fresh).
    if ((e as { code?: unknown }).code === 6 && censusRef) censusTaken();
    throw e;
  }
  // The school is already committed, so a throw would only invite a retry that registers a second school.
  // claimInvites re-syncs claims on the next sign-in.
  await syncClaims(uid).catch((e) => logger.error('registerSchool: claims sync failed', { sid, e }));
  await sendMail('schoolRegistered', async () => {
    const { appUrl, webUrl } = mailConfig();
    const to = token.email?.toLowerCase();
    if (!to) return undefined;
    const school = { nameEn, nameSi, colors: { primary } };
    return { to: [to], message: schoolRegistered({ adminName, school, loginUrl: `${appUrl}/login`, webUrl }) };
  });
  await sendMail(moe ? 'schoolListed' : 'schoolPendingReview', async () => {
    const { appUrl, webUrl, superEmails } = mailConfig();
    if (!superEmails.length) return undefined;
    const school: NewSchoolDetails = {
      schoolId: sid,
      ...details,
      city,
      censusNo,
      registrant: { name: adminName, email: token.email?.toLowerCase() },
    };
    const schoolUrl = `${appUrl}/super/schools/${sid}`;
    const message = moe
      ? schoolListed({ school, schoolUrl, webUrl })
      : schoolPendingReview({ school, schoolUrl, webUrl, ...(await possibleDuplicates(sid, nameEn || nameSi || '', district)) });
    return { to: superEmails, message };
  });
  return { schoolId: sid };
});
