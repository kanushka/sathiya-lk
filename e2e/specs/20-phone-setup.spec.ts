// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN, SID } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const pages = ['/admin/teachers', '/admin/members', '/admin/subjects', '/admin/grades', '/admin/templates', '/admin/profile'];

test('setup pages fit a phone without sideways scrolling', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  for (const path of pages) {
    await page.goto(`/s/${SID}${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(375);
  }
});

test('teachers and subjects show as grouped lists on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/teachers`);
  await expect(page.getByRole('table')).toHaveCount(0);
  const rizan = page.getByRole('region', { name: /^Not linked/ }).getByRole('button', { name: 'Edit Mr. A. Rizan' });
  await expect(rizan).toContainText('SCC031');
  await expect(rizan).toContainText('Gr 6–11');
  await shot(page, 'phone-teachers');

  await page.goto(`/s/${SID}/admin/subjects`);
  await page.getByRole('button', { name: 'Edit Art' }).tap();
  const edit = page.getByRole('dialog', { name: 'Edit subject' });
  await edit.getByLabel('Name in English').fill('Art & Craft');
  await edit.getByRole('button', { name: 'Save' }).tap();
  await expect(edit).toBeHidden();
  await page.getByRole('button', { name: 'Edit Art & Craft' }).tap();
  await edit.getByLabel('Name in English').fill('Art');
  await edit.getByRole('button', { name: 'Save' }).tap();
  await expect(page.getByRole('button', { name: 'Edit Art' })).toBeVisible();
});

test('grades and templates are usable on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/grades`);
  const switcher = page.getByRole('navigation', { name: 'Grades' });
  await switcher.getByRole('button', { name: /^Grade 12\b/ }).tap();
  await expect(page.getByRole('heading', { name: 'Grade 12 settings' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await shot(page, 'phone-grades');

  await page.goto(`/s/${SID}/admin/templates`);
  const remove = page.getByRole('button', { name: 'Remove row 1' });
  await expect(remove).toBeVisible();
  const box = await remove.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: '5 minutes more, row 1' }).tap();
  await expect(page.getByTestId('template-row').nth(1)).toContainText('08:35–09:15');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await shot(page, 'phone-templates');
});

test('Sinhala list rows stay inside the screen', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/teachers`);
  await page.getByRole('button', { name: 'Open menu' }).tap();
  await page.getByRole('button', { name: /^Language/ }).tap();
  await page.getByRole('button', { name: 'මෙනුව වසන්න' }).tap();
  for (const path of ['/admin/teachers', '/admin/members', '/admin/subjects']) {
    await page.goto(`/s/${SID}${path}`);
    await expect(page.getByRole('listitem').first()).toBeVisible();
    const outside = await page.locator('main li').evaluateAll((rows) => {
      const vw = document.documentElement.clientWidth;
      return rows.filter((r) => r.getBoundingClientRect().right > vw + 1).length;
    });
    expect(outside, path).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(375);
  }
  await page.getByRole('button', { name: 'මෙනුව විවෘත කරන්න' }).tap();
  await page.getByRole('button', { name: /^භාෂාව/ }).tap();
});
