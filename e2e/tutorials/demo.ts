// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Entry } from '@sathiya/core';
import { ctx, entries } from '@sathiya/core/fixtures';
import type { Page } from '@playwright/test';
import { callAs, idToken } from '../helpers';
import { admin, TERMS_VERSION, YEAR_ID } from '../../scripts/seed';
import type { Tutorial } from './kit';

// fresh: just registered. subjects: + subject list. classes: + grades, classes and templates. full: + teachers and a draft timetable.
export type Stage = 'fresh' | 'subjects' | 'classes' | 'full';

// Every class except this one keeps its fixture lessons, so the timetable video can fill it from empty.
export const EMPTY_CLASS = 'c-6c';
const PASSWORD = 'demo-pass-1';
const strip = <T extends { id: string }>({ id: _id, ...rest }: T) => rest;

export async function demoSchool(flow: string, lang: string, census: string, stage: Stage): Promise<{ email: string; sid: string }> {
  const { auth, db } = admin();
  const email = `${flow}.${lang}@demo.sathiya.lk`;
  await auth.createUser({ email, password: PASSWORD, emailVerified: true, displayName: lang === 'si' ? 'කේ. පෙරේරා' : 'K. Perera' });
  const { schoolId: sid } = await callAs<{ schoolId: string }>(await idToken(email, PASSWORD), 'registerSchool', {
    school: { censusNo: census, nameSi: 'සතිය ආදර්ශ විද්‍යාලය', city: 'Kandy', staffPrefix: 'SDC', colors: { primary: '#0E6B6A', second: '#F2A541' }, termsVersion: TERMS_VERSION },
    adminName: lang === 'si' ? 'කේ. පෙරේරා' : 'K. Perera',
    acceptedTermsVersion: TERMS_VERSION,
  });
  if (stage === 'fresh') return { email, sid };

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

export async function signIn(page: Page, tut: Tutorial, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(tut.t('auth', 'signIn.email'), { exact: true }).fill(email);
  await page.getByLabel(tut.t('auth', 'signIn.password'), { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: tut.t('auth', 'signIn.submit'), exact: true }).click();
  await page.waitForURL(/\/admin$/);
}
