// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Entry } from '@sathiya/core';
import { ctx, entries } from '@sathiya/core/fixtures';
import { expect, type Locator, type Page } from '@playwright/test';
import { callAs, idToken } from '../helpers';
import { admin, TERMS_VERSION, YEAR_ID } from '../../scripts/seed';
import type { Tutorial } from './kit';

// fresh: just registered. subjects: + subject list. classes: + grades, classes and templates. full: + teachers and a draft timetable.
// clean: a small school (grades 6-7, four classes) that auto-fill can solve completely, with an empty draft year.
export type Stage = 'fresh' | 'subjects' | 'classes' | 'full' | 'clean';

// Every class except this one keeps its fixture lessons, so the timetable video can fill it from empty.
export const EMPTY_CLASS = 'c-6c';
export const PASSWORD = 'demo-pass-1';
const strip = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

export async function demoSchool(flow: string, lang: string, census: string, stage: Stage): Promise<{ email: string; sid: string }> {
  const { auth, db } = admin();
  const email = `${flow}.${lang}@demo.sathiya.lk`;
  // One run registers a school per flow and language, far past the per-IP daily limit, so reset it in the emulator.
  for (const doc of (await db.collection('rateLimits').get()).docs) await doc.ref.delete();
  await auth.createUser({ email, password: PASSWORD, emailVerified: true, displayName: lang === 'si' ? 'කේ. පෙරේරා' : 'K. Perera' });
  const { schoolId: sid } = await callAs<{ schoolId: string }>(await idToken(email, PASSWORD), 'registerSchool', {
    school: { censusNo: census, nameSi: 'සතිය ආදර්ශ විද්‍යාලය', city: 'Kandy', staffPrefix: 'SDC', colors: { primary: '#0E6B6A', second: '#F2A541' }, termsVersion: TERMS_VERSION },
    adminName: lang === 'si' ? 'කේ. පෙරේරා' : 'K. Perera',
    acceptedTermsVersion: TERMS_VERSION,
  });
  if (stage === 'fresh') return { email, sid };
  if (stage === 'clean') {
    await writeClean(db, sid);
    return { email, sid };
  }

  const batch = db.batch();
  const put = (col: string, items: Array<{ id: string }>, map: (x: Record<string, unknown>) => Record<string, unknown> = (x) => x) => {
    for (const item of items) batch.set(db.doc(`${col}/${item.id}`), map(strip(item)));
  };
  put(paths.subjects(sid), ctx.subjects);
  if (stage !== 'subjects') {
    for (const doc of (await db.collection(paths.templates(sid)).get()).docs) batch.delete(doc.ref);
    put(paths.templates(sid), ctx.templates);
    put(paths.grades(sid), ctx.grades);
    put(paths.classes(sid), ctx.classes, stage === 'full' ? undefined : ({ classTeacherId: _t, ...c }) => c);
    batch.update(db.doc(paths.school(sid)), { grades: ctx.school.grades });
  }
  if (stage === 'full') {
    put(paths.teachers(sid), ctx.teachers, (t) => ({ ...t, staffId: String(t.staffId).replace(/^SCC/, 'SDC') }));
    batch.set(db.doc(`${paths.years(sid)}/${YEAR_ID}`), { label: '2027', status: 'draft' });
    batch.update(db.doc(paths.school(sid)), { activeYearId: YEAR_ID });
    put(paths.entries(sid, YEAR_ID), (entries as Entry[]).filter((e) => !e.classIds.includes(EMPTY_CLASS)));
  }
  await batch.commit();
  return { email, sid };
}

const plan: Array<[string, string, string, string, number]> = [
  ['maths', 'Mathematics', 'ගණිතය', 'Maths', 6],
  ['sinhala', 'Sinhala', 'සිංහල', 'Sinhala', 6],
  ['science', 'Science', 'විද්‍යාව', 'Science', 5],
  ['english', 'English', 'ඉංග්‍රීසි', 'English', 5],
  ['history', 'History', 'ඉතිහාසය', 'History', 3],
  ['geography', 'Geography', 'භූගෝල විද්‍යාව', 'Geo', 3],
  ['buddhism', 'Buddhism', 'බුද්ධ ධර්මය', 'Bud', 3],
  ['health', 'Health & PE', 'සෞඛ්‍ය හා ශාරීරික අධ්‍යාපනය', 'Health', 3],
  ['art', 'Art', 'චිත්‍ර', 'Art', 3],
  ['ict', 'ICT', 'තොරතුරු තාක්ෂණය', 'ICT', 3],
];
const colours = ['#D4ECEA', '#F2E2E7', '#DCE7FA', '#E3E9D2', '#EFE3D3', '#E2EEE0', '#FBEAC9', '#E6E0F2', '#F6DDD3', '#DDEFF2'];
const staff: Array<[string, string, string, string, string[], string]> = [
  ['perera', 'SDC001', 'Mrs', 'N. Perera', ['maths'], '6A'],
  ['silva', 'SDC002', 'Mr', 'R. Silva', ['sinhala'], '6B'],
  ['gunasekara', 'SDC003', 'Mrs', 'S. Gunasekara', ['science', 'health'], '7A'],
  ['rizan', 'SDC004', 'Mr', 'A. Rizan', ['english', 'ict'], '7B'],
  ['bandara', 'SDC005', 'Mr', 'P. Bandara', ['history', 'geography'], ''],
  ['ananda', 'SDC006', 'Ven.', 'Ananda Thero', ['buddhism'], ''],
  ['fernando', 'SDC007', 'Mrs', 'K. Fernando', ['art'], ''],
];

async function writeClean(db: ReturnType<typeof admin>['db'], sid: string): Promise<void> {
  const template = (await db.collection(paths.templates(sid)).get()).docs[0]!.id;
  const batch = db.batch();
  plan.forEach(([id, nameEn, nameSi, short], i) => batch.set(db.doc(`${paths.subjects(sid)}/s-${id}`), { nameEn, nameSi, short, color: colours[i] }));
  for (const n of [6, 7])
    batch.set(db.doc(`${paths.grades(sid)}/g-${n}`), { number: n, plan: plan.map(([id, , , , perWeek]) => ({ kind: 'subject', subjectId: `s-${id}`, perWeek })) });
  for (const name of ['6A', '6B', '7A', '7B']) {
    const teacher = staff.find((t) => t[5] === name)![0];
    batch.set(db.doc(`${paths.classes(sid)}/c-${name.toLowerCase()}`), { gradeId: `g-${name[0]}`, name, classTeacherId: `t-${teacher}`, templateId: template });
  }
  for (const [id, staffId, title, name, subjects] of staff)
    batch.set(db.doc(`${paths.teachers(sid)}/t-${id}`), { staffId, title, name, isPrimary: false, subjectIds: subjects.map((x) => `s-${x}`), grades: [6, 7], maxPerDay: 7 });
  batch.set(db.doc(`${paths.years(sid)}/${YEAR_ID}`), { label: '2027', status: 'draft' });
  batch.update(db.doc(paths.school(sid)), { grades: [6, 7], activeYearId: YEAR_ID });
  await batch.commit();
}

export async function signIn(page: Page, tut: Tutorial, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(tut.t('auth', 'signIn.email'), { exact: true }).fill(email);
  await page.getByLabel(tut.t('auth', 'signIn.password'), { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: tut.t('auth', 'signIn.submit'), exact: true }).click();
  await page.waitForURL(/\/admin$/);
}

// Runs auto-fill and saves it, before the recording starts.
export async function autoFill(page: Page, tut: Tutorial, sid: string): Promise<void> {
  await page.goto(`/s/${sid}/admin/timetable/auto-fill`);
  await page.getByRole('button', { name: tut.t('autofill', 'continue'), exact: true }).click();
  await page.getByRole('button', { name: tut.t('autofill', 'options.run'), exact: true }).click();
  await page.getByRole('button', { name: tut.t('autofill', 'preview.save'), exact: true }).click({ timeout: 30_000 });
  await expect(page.getByText(tut.rx('autofill', 'preview.saved_other')).first()).toBeVisible({ timeout: 20_000 });
  await page.goto(`/s/${sid}/admin`);
}

// The emulator's popup sometimes never hands the result back to the app. Retry with a fresh popup and cut the stall from the video.
export async function signInWithGoogle(tut: Tutorial, button: Locator, email: string, name: string, during: () => Promise<void>): Promise<void> {
  let stalled: number | undefined;
  for (let attempt = 0; ; attempt++) {
    const opened = tut.page.waitForEvent('popup');
    await button.click();
    if (attempt === 0) await during();
    const popup = await opened;
    await popup.waitForLoadState();
    await popup.getByText('Add new account').click();
    await popup.locator('#email-input').fill(email);
    await popup.locator('#display-name-input').fill(name);
    const closed = popup.waitForEvent('close', { timeout: 6_000 }).then(() => true, () => false);
    stalled ??= tut.mark();
    await popup.locator('#sign-in').click();
    if (await closed) {
      if (attempt > 0) tut.cut(stalled);
      return;
    }
    if (attempt === 2) throw new Error('Google popup sign-in did not complete');
    await popup.close();
    await tut.page.waitForTimeout(500);
  }
}
