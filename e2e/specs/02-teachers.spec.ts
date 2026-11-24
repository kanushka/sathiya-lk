// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin, pick, shot } from '../helpers';

test('admin adds a teacher, who shows as not linked', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await shot(page, 'admin-dashboard');
  await page.getByRole('link', { name: 'Teachers' }).click();
  await page.getByRole('button', { name: '+ Add teacher' }).click();

  const modal = page.getByRole('dialog', { name: 'Add teacher' });
  await expect(modal.getByLabel('Staff ID')).toHaveValue('SCC059');
  await pick(modal, 'Title', 'Mrs.');
  await modal.getByLabel('Name in English').fill('E. Tester');
  await pick(modal, 'Subjects', 'Mathematics');
  await page.keyboard.press('Escape');
  await modal.getByRole('group', { name: 'Grades' }).getByRole('button', { name: '6', exact: true }).click();
  await modal.getByRole('button', { name: 'Save teacher' }).click();
  await expect(modal).toHaveCount(0);

  const row = page.getByRole('row', { name: /SCC059 Mrs\. E\. Tester/ });
  await expect(row).toContainText('Not linked');
  await expect(row.getByRole('button', { name: 'Personal link' })).toBeVisible();
});

test('members list shows the admin name and email in their own columns', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Members' }).click();
  const row = page.getByRole('row', { name: new RegExp(ADMIN.name) });
  await expect(row).toContainText(ADMIN.email);
});
