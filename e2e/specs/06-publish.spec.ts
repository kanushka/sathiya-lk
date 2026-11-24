// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { classes } from '@sathiya/core/fixtures';
import { ADMIN, SID } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test('admin publishes the 2027 timetable', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await expect(page.getByRole('main').getByRole('combobox', { name: 'Timetable year' })).toContainText('2027 · draft');
  await page.getByRole('button', { name: 'Publish to teachers' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish the 2027 timetable?' });
  await dialog.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText(new RegExp(`Published: ${classes.length} classes, \\d+ teachers`))).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('main').getByRole('combobox', { name: 'Timetable year' })).toContainText('2027 · published');

  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await page.goto(`/s/${SID}/admin/print/class/c-6b?published=1`);
  await expect(page.getByRole('heading', { name: 'Grade 6 · 6B' })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText('Timetable 2027 · Class teacher Mrs. N. Perera');
  await expect(page.getByText('Religion & Aesthetic run as groups', { exact: false })).toBeVisible();
  await shot(page, 'print-sheet');
});
