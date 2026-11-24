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
  const headers = page.getByRole('columnheader');
  await expect(headers.first()).toBeAttached();
  expect((await page.locator('thead').first().boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
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

test('Sinhala card labels never spill into the next row', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin/teachers');
  await page.getByRole('button', { name: 'Open menu' }).tap();
  await page.getByRole('button', { name: /^Language/ }).tap();
  await page.getByRole('button', { name: 'මෙනුව වසන්න' }).tap();
  for (const path of ['/admin/teachers', '/admin/members']) {
    await page.goto(path);
    await expect(page.locator('td[data-label]').first()).toBeVisible();
    const spilled = await page.locator('td[data-label]').evaluateAll((cells) => cells.filter((c) => c.scrollHeight > c.clientHeight + 1).length);
    expect(spilled, path).toBe(0);
  }
  await page.getByRole('button', { name: 'මෙනුව විවෘත කරන්න' }).tap();
  await page.getByRole('button', { name: /^භාෂාව/ }).tap();
});
