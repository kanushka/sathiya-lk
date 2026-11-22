// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { T } from '@sathiya/core/fixtures';
import { ADMIN, SUPER, teacherLogin } from '../../scripts/seed';
import { loginAdmin, loginTeacher, shot } from '../helpers';

test('login switches between admin and teacher forms', async ({ page }) => {
  await page.goto('/login?report=1');
  await page.getByRole('dialog', { name: 'Report a school' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('tab', { name: 'School admin' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'School admin' }).getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await page.getByRole('tab', { name: 'Teacher' }).click();
  await expect(page).toHaveURL(/\/login\?report=1&as=teacher$/);
  await expect(page.getByRole('tabpanel', { name: 'Teacher' }).getByRole('combobox')).toBeFocused();
  await page.getByRole('tab', { name: 'Teacher' }).press('ArrowLeft');
  await expect(page).toHaveURL(/\/login\?report=1$/);
  await expect(page.getByRole('tab', { name: 'School admin' })).toBeFocused();
});

test('seeded admin, teacher and super can sign in', async ({ page, browser }) => {
  await page.goto('/login');
  await shot(page, 'login');
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await expect(page.getByText('Siripura Central College').first()).toBeVisible();
  const t = await browser.newPage();
  const perera = teacherLogin(T.perera);
  await loginTeacher(t, perera.staffId, perera.password);
  await expect(t.getByRole('banner')).toContainText('Siripura Central College');
  const s = await browser.newPage();
  await loginAdmin(s, SUPER.email, SUPER.password, /\/super$/);
});
