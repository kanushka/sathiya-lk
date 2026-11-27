// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ADMIN, SID } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const W = 375;
const H = 812;

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('not visible');
  return b;
}

const dayHeader = (page: Page, d: string) => page.getByRole('group', { name: /grid/i }).getByText(d, { exact: true });

test('admin edits a class timetable on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/timetable/class/c-12a`);
  await page.getByRole('radio', { name: 'Week' }).tap();
  const grid = page.getByRole('group', { name: /grid/i });
  await expect(grid).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(W);

  const prev = await box(page.getByRole('button', { name: 'Previous class' }));
  const next = await box(page.getByRole('button', { name: 'Next class' }));
  const select = await box(page.getByRole('combobox', { name: /^Class/ }));
  expect(Math.abs(prev.y - next.y)).toBeLessThan(2);
  expect(Math.abs(prev.y + prev.height / 2 - (select.y + select.height / 2))).toBeLessThan(4);

  for (const d of ['Mon', 'Tue', 'Wed']) {
    const b = await box(dayHeader(page, d));
    expect(b.x + b.width).toBeLessThanOrEqual(W);
  }
  await expect(dayHeader(page, 'Thu')).not.toBeInViewport();
  await shot(page, 'phone-grid');

  await grid.evaluate((el) => el.scrollBy({ left: el.clientWidth }));
  await expect(dayHeader(page, 'Fri')).toBeInViewport();
  expect((await box(page.getByText('P1', { exact: true }))).x).toBeLessThan(60);

  const slot = page.getByRole('button', { name: /^Friday, period 6, [0-9:–]+: empty, Add lesson$/ });
  await slot.scrollIntoViewIfNeeded();
  await slot.tap();
  const sheet = page.getByRole('dialog', { name: 'Choose a subject' });
  await expect(sheet).toBeVisible();
  const s = await box(sheet);
  expect(s.x).toBe(0);
  expect(s.width).toBe(W);
  expect(Math.round(s.y + s.height)).toBe(H);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await expect(sheet).toBeFocused();
  await shot(page, 'phone-picker-sheet');

  await sheet.getByRole('option', { name: /^Buddhism/ }).tap();
  const teacher = page.getByRole('dialog', { name: 'Choose a teacher' });
  await teacher.getByRole('option', { name: /^Ven\. Ananda Thero/ }).tap();
  await teacher.getByRole('button', { name: 'Assign' }).tap();
  await expect(teacher).toBeHidden();

  const bar = page.getByRole('region', { name: 'Pin mode' });
  await expect(bar).toBeVisible();
  const b = await box(bar);
  expect(Math.round(b.y + b.height)).toBe(H);
  expect(b.width).toBe(W);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const lastRow = await box(page.getByRole('button', { name: /^Friday, period 8, / }));
  expect(lastRow.y + lastRow.height).toBeLessThan((await box(bar)).y);
  await shot(page, 'phone-pin-bar');
  await bar.getByRole('button', { name: 'Done' }).tap();
  await expect(bar).toBeHidden();
  await expect(page.getByRole('button', { name: /^Friday, period 6, [0-9:–]+: Bud Ven\. Ananda Thero$/ })).toBeAttached();
});

test('Sinhala day names fit their columns on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/timetable/class/c-12a`);
  await page.getByRole('button', { name: 'Open menu' }).tap();
  await page.getByRole('button', { name: /^Language/ }).tap();
  await page.getByRole('button', { name: /මෙනුව වසන්න/ }).tap();
  await page.getByRole('radio', { name: 'සතිය' }).tap();
  for (const d of ['සඳු', 'අඟ', 'බදා']) {
    const header = page.getByText(d, { exact: true });
    await expect(header).toBeVisible();
    expect(await header.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(W);
  await page.getByRole('button', { name: 'මෙනුව විවෘත කරන්න' }).tap();
  await page.getByRole('button', { name: /^භාෂාව|^Language/ }).tap();
});

test('teacher view header fits one row on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/timetable/teacher`);
  const prev = await box(page.getByRole('button', { name: 'Previous teacher' }));
  const next = await box(page.getByRole('button', { name: 'Next teacher' }));
  expect(Math.abs(prev.y - next.y)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(W);
});
