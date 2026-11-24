// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { T } from '@sathiya/core/fixtures';
import { ADMIN, SUPER, teacherLogin } from '../../scripts/seed';
import { loginAdmin, loginTeacher, shot } from '../helpers';

test('login offers Google first, then email, then account creation', async ({ page }) => {
  await page.goto('/login?report=1');
  await page.getByRole('dialog', { name: 'Report a school' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('old signed-out /admin and /me links land on the login page', async ({ page }) => {
  await page.goto('/me');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/admin/teachers');
  await expect(page).toHaveURL(/\/login$/);
});

test('seeded admin, teacher and super can sign in', async ({ page, browser }) => {
  await page.goto('/login');
  await shot(page, 'login');
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await expect(page.getByText('Siripura Central College').first()).toBeVisible();
  const t = await (await browser.newContext()).newPage();
  const perera = teacherLogin(T.perera);
  await loginTeacher(t, perera.email, perera.password);
  await expect(t.getByRole('banner')).toContainText('Siripura Central College');
  const s = await (await browser.newContext()).newPage();
  await loginAdmin(s, SUPER.email, SUPER.password, /\/super$/);
});
