// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { T } from '@sathiya/core/fixtures';
import { ADMIN, SUPER, teacherLogin } from '../../scripts/seed';
import { loginAdmin, loginTeacher, shot } from '../helpers';

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
