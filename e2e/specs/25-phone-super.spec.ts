// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { PENDING_SCHOOL, SID, SUPER } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const pages: Array<[string, string]> = [
  ['/super', 'schools'],
  [`/super/schools/${PENDING_SCHOOL.sid}`, 'school-review'],
  [`/super/schools/${SID}`, 'school-detail'],
  ['/super/reports', 'reports'],
  ['/super/usage', 'usage'],
  ['/super/subjects', 'subjects'],
  ['/super/terms', 'terms'],
  ['/super/announcements', 'announcements'],
];

test('every super admin page fits a phone without sideways scrolling', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  for (const [path, name] of pages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
    await shot(page, `phone-super-${name}`);
  }
});

test('the super admin menu moves between pages', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Sathiya' });
  await expect(menu.getByRole('link', { name: 'Schools' })).toHaveAttribute('aria-current', 'page');
  await shot(page, 'phone-super-menu');
  await menu.getByRole('link', { name: 'Usage' }).click();
  await expect(page).toHaveURL(/\/super\/usage$/);
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Usage', level: 1 })).toBeVisible();
});

test('approve and reject sit at the bottom of the review card on a phone', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  await page.goto(`/super/schools/${PENDING_SCHOOL.sid}`);
  const card = page.getByRole('region', { name: 'Review' });
  const approve = card.getByRole('button', { name: 'Approve school' });
  const reject = card.getByRole('button', { name: 'Reject…' });
  await expect(approve).toBeVisible();
  const [a, r, reg] = await Promise.all([approve.boundingBox(), reject.boundingBox(), card.getByText('Registered by').boundingBox()]);
  expect(a!.height).toBeGreaterThanOrEqual(44);
  expect(a!.x).toBeLessThan(r!.x);
  expect(a!.y).toBeGreaterThan(reg!.y);
});
