// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ADMIN, SID } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

const W = 390;
test.use({ viewport: { width: W, height: 844 }, isMobile: true, hasTouch: true });

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error('not visible');
  return b;
}

async function noSideways(page: Page, path: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(W);
}

const sectionTitles = (page: Page) =>
  page.locator('main section > h2').evaluateAll((hs) => hs.map((h) => h.firstChild?.textContent?.trim() ?? ''));

test('every admin page fits a phone without sideways scrolling', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  const paths = ['', '/teachers', '/subjects', '/grades', '/templates', '/members', '/profile', '/relief', '/timetable/class/c-1a', '/timetable/teacher/t-rizan'];
  for (const path of paths) {
    await page.goto(`/s/${SID}/admin${path}`);
    await expect(page.locator('main').getByRole('heading').or(page.getByRole('radiogroup')).first()).toBeVisible();
    await page.waitForTimeout(500);
    await noSideways(page, path || '/');
  }
});

test('teachers are grouped into join requests, not linked and linked', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/teachers`);
  await expect(page.getByRole('region', { name: /^Linked/ })).toBeVisible();
  expect(await sectionTitles(page)).toEqual(['Join requests', 'Not linked', 'Linked']);

  const header = page.getByTestId('page-header');
  const title = await box(header.getByRole('heading', { level: 1 }));
  const add = await box(header.getByRole('button', { name: '+ Add teacher' }));
  expect(Math.abs(title.y + title.height / 2 - (add.y + add.height / 2))).toBeLessThan(4);

  const request = page.getByRole('region', { name: /^Join requests/ }).getByRole('listitem').first();
  await expect(request).toContainText('kumari@siripura.example.com');
  const approve = await box(request.getByRole('button', { name: 'Approve' }));
  const reject = await box(request.getByRole('button', { name: 'Reject' }));
  expect(Math.abs(approve.y - reject.y)).toBeLessThan(1);
  expect(approve.height).toBeGreaterThanOrEqual(44);

  const link = page.getByRole('button', { name: 'Make a personal link for Mr. A. Rizan' });
  expect((await box(link)).height).toBeGreaterThanOrEqual(44);
  expect((await box(page.getByRole('button', { name: 'Edit Mr. A. Rizan' }))).width).toBeGreaterThan(250);

  const invite = page.getByRole('region', { name: 'Invite link' });
  await expect(invite.getByRole('button', { name: 'Copy invite link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn off link' })).toHaveCount(0);
  await shot(page, 'phone-teachers-list');

  await page.getByRole('button', { name: 'Edit Mr. A. Rizan' }).tap();
  const edit = page.getByRole('dialog', { name: 'Edit teacher' });
  await edit.getByRole('button', { name: 'More actions for this teacher' }).tap();
  await expect(page.getByRole('menuitem', { name: 'Delete teacher' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(edit).toBeVisible();
});

test('subjects and members use grouped sections', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/subjects`);
  await expect(page.getByRole('region', { name: /^In the timetable/ })).toBeVisible();
  expect(await sectionTitles(page)).toEqual(['Not used yet', 'In the timetable']);
  const used = page.getByRole('region', { name: /^In the timetable/ });
  await expect(used.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  await expect(used.getByText(/^\d+ slots?$/).first()).toBeVisible();
  await shot(page, 'phone-subjects-list');

  await page.goto(`/s/${SID}/admin/members`);
  await expect(page.getByRole('region', { name: /^Teachers with access/ })).toBeVisible();
  expect(await sectionTitles(page)).toEqual(['Admins', 'Teachers with access', 'Pending invites']);
  await expect(page.getByRole('region', { name: /^Admins/ })).toContainText('admin@siripura.example.com');
  await expect(page.getByRole('region', { name: 'Admin sign-in link' }).getByRole('button', { name: 'Copy admin sign-in link' })).toBeVisible();
  await shot(page, 'phone-members-list');
});

test('the class timetable opens on the Day view', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/timetable/class/c-1a`);
  await expect(page.getByRole('radio', { name: 'Day', exact: true })).toHaveAttribute('aria-checked', 'true');
  for (const r of await page.getByRole('radiogroup').getByRole('radio').all()) expect((await box(r)).height).toBeGreaterThanOrEqual(44);

  await page.getByRole('radio', { name: /^Monday, \d+ of \d+$/ }).tap();
  const day = page.getByRole('list', { name: 'Monday periods' });
  await expect(day).toBeVisible();
  const p1 = day.getByRole('button', { name: /^Monday, period 1, / });
  await expect(p1).toContainText('Sinhala');
  expect((await box(p1)).width).toBeGreaterThan(300);
  await expect(day.getByText(/^Interval · /)).toBeVisible();
  await expect(page.getByRole('group', { name: /grid/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Auto-fill' })).toBeVisible();
  await noSideways(page, 'day view');
  await shot(page, 'phone-day-view');

  await day.getByRole('button', { name: /^Monday, period 2, .*Add lesson$/ }).tap();
  const sheet = page.getByRole('dialog', { name: 'Choose a subject' });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'More timetable actions' }).tap();
  await expect(page.getByRole('menuitem', { name: 'Print' })).toBeVisible();
  await page.keyboard.press('Escape');

  const summary = page.getByText('1A subjects');
  await summary.tap();
  await expect(page.getByRole('button', { name: 'Pin Sinhala' })).toBeVisible();

  await page.getByRole('radio', { name: 'Week' }).tap();
  await expect(page.getByRole('group', { name: /grid/i })).toBeVisible();
  await noSideways(page, 'week view');
});

test('the teacher timetable has the same Day view', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/timetable/teacher/t-rizan`);
  await page.getByRole('radio', { name: /^Monday, \d+ of 7$/ }).tap();
  await expect(page.getByRole('list', { name: 'Monday periods' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print' })).toHaveCount(0);
  await noSideways(page, 'teacher day view');
});
