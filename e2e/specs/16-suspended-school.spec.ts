// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { school, T } from '@sathiya/core/fixtures';
import { ADMIN, SID, SUPER, teacherLogin } from '../../scripts/seed';
import { adminForm, callAs, idToken, loginAdmin, loginTeacher, shot, teacherForm } from '../helpers';

const suspendedHeading = { name: 'This school is suspended' } as const;

test('a suspended school locks out its admin and teachers until re-enabled', async ({ page, browser }) => {
  const teacher = await (await browser.newContext()).newPage();
  const perera = teacherLogin(T.perera);
  await loginTeacher(teacher, perera.staffId, perera.password);

  try {
    await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
    const row = page.getByRole('row', { name: new RegExp(`^${school.nameEn}`) });
    await row.getByRole('button', { name: 'Disable' }).click();
    await page.getByRole('dialog', { name: `Disable ${school.nameEn}?` }).getByRole('button', { name: 'Disable school' }).click();
    await expect(row).toContainText('Disabled');

    await page.goto(`/s/${SID}`);
    await expect(page.getByRole('heading', suspendedHeading)).toHaveCount(0);

    const admin = await (await browser.newContext()).newPage();
    await admin.goto('/login');
    const form = adminForm(admin);
    await form.getByLabel('Email').fill(ADMIN.email);
    await form.getByLabel('Password').fill(ADMIN.password);
    await form.getByRole('button', { name: 'Log in' }).click();
    await expect(admin.getByRole('heading', suspendedHeading)).toBeVisible();
    await expect(admin.getByRole('link', { name: 'Contact the Sathiya team' })).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Report a problem' })).toBeVisible();
    await shot(admin, 'suspended-admin');
    await admin.getByRole('button', { name: 'Sign out' }).click();
    await expect(admin).toHaveURL(/\/login/);

    await teacher.reload();
    await expect(teacher.getByRole('heading', suspendedHeading)).toBeVisible();
    await expect(teacher.getByText('Mathematics')).toHaveCount(0);

    const slip = await (await browser.newContext()).newPage();
    await slip.goto(`/login?as=teacher&school=${SID}`);
    await expect(teacherForm(slip).getByText('This school is currently suspended. Contact your school admin.')).toBeVisible();
  } finally {
    await callAs(await idToken(SUPER.email, SUPER.password), 'setSchoolStatus', { schoolId: SID, status: 'active' });
  }

  await teacher.reload();
  await expect(teacher).toHaveURL(/\/me$/);
  await expect(teacher.getByRole('heading', suspendedHeading)).toHaveCount(0);
  await expect(teacher.getByRole('banner')).toContainText('SCC024');
});
