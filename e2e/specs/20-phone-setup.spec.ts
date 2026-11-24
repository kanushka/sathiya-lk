// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const pages = ['/admin/teachers', '/admin/members', '/admin/subjects', '/admin/grades', '/admin/templates', '/admin/profile'];

test('setup pages fit a phone without sideways scrolling', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(375);
  }
});

test('teachers and subjects show as labelled cards on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin/teachers');
  const rizan = page.getByRole('row').filter({ hasText: 'Mr. A. Rizan' });
  await expect(rizan.getByRole('cell').filter({ hasText: 'SCC031' })).toBeVisible();
  await expect(rizan.locator('td[data-label="Grades"]')).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(0);
  await shot(page, 'phone-teachers');

  await page.goto('/admin/subjects');
  const name = page.getByRole('textbox', { name: 'English name of Art' });
  await name.fill('Art & Craft');
  await name.press('Enter');
  await expect(page.getByRole('textbox', { name: 'English name of Art & Craft' })).toHaveValue('Art & Craft');
  await page.getByRole('textbox', { name: 'English name of Art & Craft' }).fill('Art');
  await page.getByRole('textbox', { name: 'English name of Art & Craft' }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'English name of Art' })).toHaveValue('Art');
});

test('grades and templates are usable on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin/grades');
  const switcher = page.getByRole('navigation', { name: 'Grades' });
  await switcher.getByRole('button', { name: /^Grade 12\b/ }).tap();
  await expect(page.getByRole('heading', { name: 'Grade 12 settings' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await shot(page, 'phone-grades');

  await page.goto('/admin/templates');
  const start = page.getByLabel('Start, row 1');
  await expect(start.first()).toBeVisible();
  const box = await start.first().boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await shot(page, 'phone-templates');
});
