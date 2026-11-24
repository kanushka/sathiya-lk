// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN, SUPER } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const notice = 'Best on a bigger screen';

test('admin on a phone gets the phone shell, no notice', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: notice })).toHaveCount(0);
  await expect(page.getByText('Admin screens work best on a laptop, desktop or tablet.')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Siripura Central College' });
  await expect(menu).toBeVisible();
  await shot(page, 'phone-shell-menu');
  await menu.getByRole('link', { name: 'Teachers' }).click();
  await expect(page).toHaveURL(/\/admin\/teachers$/);
  await expect(menu).toHaveCount(0);

  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible();
});

test('super admin on a phone still sees the notice', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  await expect(page.getByRole('dialog', { name: notice })).toBeVisible();
});
