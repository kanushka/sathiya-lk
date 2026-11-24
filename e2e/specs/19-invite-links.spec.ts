// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { paths } from '@sathiya/core';
import { school, T } from '@sathiya/core/fixtures';
import { admin, ADMIN, INVITEE, joinPath, REQUESTER, SID, YEAR_ID } from '../../scripts/seed';
import { callAs, freshSchoolAdmin, idToken, loginAdmin, loginTeacher, pick, shot, submitSignIn } from '../helpers';

test.beforeAll(async () => {
  await callAs(await idToken(ADMIN.email, ADMIN.password), 'publishYear', { schoolId: SID, yearId: YEAR_ID });
});

test('admin approves a join request and the teacher sees their timetable', async ({ page, browser }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Teachers' }).click();
  const requests = page.getByRole('region', { name: 'Join requests (1)' });
  await expect(requests).toContainText(REQUESTER.email);
  await expect(requests).toContainText('says they are Mrs. D. Kumari · SCC007');
  await shot(page, 'join-requests');
  await requests.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(`${REQUESTER.name} can now see their timetable`)).toBeVisible();
  await expect(requests).toHaveCount(0);
  await expect(page.getByRole('row', { name: /SCC007/ })).toContainText('Linked');

  const teacher = await (await browser.newContext()).newPage();
  await loginTeacher(teacher, REQUESTER.email, REQUESTER.password);
  await expect(teacher.getByRole('banner')).toContainText('SCC007');
});

test('a teacher whose email matches their record joins with the school link at once', async ({ page, browser }) => {
  const password = 'invitee-pass-1';
  await admin().auth.createUser({ email: INVITEE.email, password, emailVerified: true });

  await page.goto(joinPath());
  await expect(page).toHaveURL(/\/login$/);
  await submitSignIn(page, INVITEE.email, password);
  await expect(page).toHaveURL(new RegExp(`/s/${SID}/me$`));
  await expect(page.getByRole('banner')).toContainText('SCC014');

  const adminPage = await (await browser.newContext()).newPage();
  await loginAdmin(adminPage, ADMIN.email, ADMIN.password);
  await adminPage.getByRole('link', { name: 'Teachers' }).click();
  await expect(adminPage.getByRole('row', { name: /SCC014/ })).toContainText('Linked');
});

test('a user in two schools switches between them', async ({ page }) => {
  const other = await freshSchoolAdmin('switch');
  await admin().db.doc(`${paths.teachers(SID)}/${T.gunasekara}`).update({ email: other.email });

  await page.goto(joinPath());
  await expect(page).toHaveURL(/\/login$/);
  await submitSignIn(page, other.email, other.password);
  await expect(page).toHaveURL(new RegExp(`/s/${SID}/me$`));
  await expect(page.getByRole('banner')).toContainText('SCC019');
  await shot(page, 'school-switcher');

  await pick(page, /^School /, /^switch School · Admin$/);
  await expect(page).toHaveURL(new RegExp(`/s/${other.sid}/admin$`));
  await expect(page.getByRole('combobox', { name: /^School / })).toHaveText('switch School · Admin');
  await page.goto('/');
  await expect(page).toHaveURL(new RegExp(`/s/${other.sid}/admin$`));

  await pick(page, /^School /, `${school.nameEn} · Teacher`);
  await expect(page).toHaveURL(new RegExp(`/s/${SID}/me$`));
  await expect(page.getByRole('banner')).toContainText('SCC019');
});
