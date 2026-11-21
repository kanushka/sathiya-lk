// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Page } from '@playwright/test';
import { S, T } from '@sathiya/core/fixtures';
import { ADMIN, SID, YEAR_ID } from '../../scripts/seed';
import { callAs, idToken, loginAdmin, shot } from '../helpers';

const pinCell = (page: Page, day: string, n: number) => page.getByRole('button', { name: new RegExp(`^${day}, period ${n}, [0-9:–]+: pin History with Mr\\. R\\. Silva`) });
const pinnedCell = (page: Page, day: string, n: number) => page.getByRole('button', { name: new RegExp(`^${day}, period ${n}, [0-9:–]+: History Mr\\. R\\. Silva, pinned, click to unpin$`) });

test('class view: assign once, then pin, unpin, go over plan and exit pin mode', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'By class' }).click();
  await page.getByRole('combobox', { name: 'Class' }).selectOption({ label: 'Grade 6 · 6A' });
  await expect(page).toHaveURL(/\/admin\/timetable\/class\/c-6a$/);

  const plus = page.getByRole('button', { name: 'Monday, period 2, 08:30–09:10: empty, Add lesson' });
  await plus.click();
  await plus.press('Enter');
  const popup = page.getByRole('dialog', { name: 'Choose a subject' });
  await expect(popup.getByRole('searchbox', { name: 'Search subjects' })).toBeFocused();
  await page.keyboard.type('History');
  await page.keyboard.press('Enter');
  const teachers = page.getByRole('dialog', { name: 'Choose a teacher' });
  await teachers.getByRole('button', { name: /^Mr\. R\. Silva/ }).click();
  await teachers.getByRole('button', { name: 'Assign' }).click();
  await expect(teachers).toBeHidden();

  const bar = page.getByRole('region', { name: 'Pin mode' });
  await expect(bar).toContainText('History · Mr. R. Silva');
  await expect(bar).toContainText('1 of 3 placed · 2 to go');
  await expect(page.getByRole('button', { name: /^Monday, period 5, [0-9:–]+: busy, Teaching 6B · Sinhala$/ })).toHaveAttribute('aria-disabled', 'true');
  await shot(page, 'pin-mode');

  await pinCell(page, 'Tuesday', 2).click();
  await expect(pinnedCell(page, 'Tuesday', 2)).toBeVisible();
  await pinCell(page, 'Wednesday', 3).click();
  await expect(pinnedCell(page, 'Wednesday', 3)).toBeVisible();
  await expect(bar).toContainText('3 of 3 placed · complete');

  await pinnedCell(page, 'Wednesday', 3).click();
  await expect(pinCell(page, 'Wednesday', 3)).toBeVisible();
  await expect(bar).toContainText('2 of 3 placed · 1 to go');

  await pinCell(page, 'Thursday', 4).click();
  await pinCell(page, 'Friday', 5).click();
  await expect(bar).toContainText('4 of 3 placed');
  await expect(bar.getByText('+1 over')).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Weekly plan progress' })).toHaveAttribute('data-over', 'true');
  await shot(page, 'pin-mode-over');

  await page.keyboard.press('Escape');
  await expect(bar).toBeHidden();
  await expect(page.getByRole('button', { name: 'Tuesday, period 2, 08:30–09:10: History Mr. R. Silva' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Friday, period 5, 10:50–11:30: History Mr. R. Silva' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Wednesday, period 3, .*empty, Add lesson$/ })).toBeVisible();
});

test('class view: a pin that clashes on the server is rolled back with the conflict', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto('/admin/timetable/class/c-6a');
  await page.getByRole('button', { name: 'Pin History' }).click();
  const teachers = page.getByRole('dialog', { name: 'Choose a teacher' });
  await teachers.getByRole('button', { name: /^Mr\. R\. Silva/ }).click();
  await teachers.getByRole('button', { name: 'Start pinning' }).click();
  await expect(page.getByRole('region', { name: 'Pin mode' })).toContainText('History · Mr. R. Silva');

  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route('**/saveEntry', async (route) => {
    await gate;
    await route.continue();
  });
  await pinCell(page, 'Friday', 6).click();
  await expect(pinnedCell(page, 'Friday', 6)).toBeVisible();
  await callAs(await idToken(ADMIN.email, ADMIN.password), 'saveEntry', {
    schoolId: SID,
    yearId: YEAR_ID,
    entry: { day: 4, period: 6, classIds: ['c-6c'], lessons: [{ subjectId: S.history, teacherId: T.rSilva }] },
  });
  release();

  await expect(page.getByText('Clash: Mr. R. Silva is already teaching at this time')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Friday, period 6, [0-9:–]+: busy, Teaching 6C · History$/ })).toBeVisible();
  await page.unroute('**/saveEntry');
});
