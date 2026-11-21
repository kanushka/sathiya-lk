// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Page } from '@playwright/test';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

async function openSlot(page: Page, label: string) {
  const slot = page.getByRole('button', { name: label });
  await slot.click();
  await slot.press('Enter');
}

async function chooseSubject(page: Page, name: RegExp) {
  await page.getByRole('dialog').getByRole('button', { name: 'Subject' }).click();
  await page.getByRole('option', { name }).click();
}

test('class view: fill a slot, then a busy teacher cannot be picked for an overlapping slot', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'By class' }).click();
  await page.getByRole('combobox', { name: 'Class' }).selectOption({ label: 'Grade 6 · 6B' });
  await expect(page).toHaveURL(/\/admin\/timetable\/class\/c-6b$/);
  await expect(page.getByText('36 / 40 placed')).toBeVisible();

  await openSlot(page, 'Wednesday, period 4, 09:50–10:30: empty, Add lesson');
  await chooseSubject(page, /^Science needs 2/);
  const picker = page.getByRole('dialog', { name: 'Choose a teacher' });
  await expect(picker.getByRole('listitem').filter({ hasText: 'Mrs. N. Perera' })).toContainText('Busy · 6A Mathematics');
  await expect(picker.getByRole('button', { name: /Mrs\. N\. Perera/ })).toHaveCount(0);
  await shot(page, 'class-view-slot-picker');
  await picker.getByRole('button', { name: /^Mrs\. S\. Gunasekara/ }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByRole('button', { name: 'Wednesday, period 4, 09:50–10:30: Science Mrs. S. Gunasekara' })).toBeVisible();
  await expect(page.getByText('37 / 40 placed')).toBeVisible();
  await shot(page, 'class-view');

  await page.getByRole('combobox', { name: 'Class' }).selectOption({ label: 'Grade 6 · 6C' });
  await expect(page).toHaveURL(/\/admin\/timetable\/class\/c-6c$/);
  await openSlot(page, 'Wednesday, period 4, 09:50–10:30: empty, Add lesson');
  await chooseSubject(page, /^Science/);
  const clash = page.getByRole('dialog', { name: 'Choose a teacher' });
  await expect(clash.getByRole('listitem').filter({ hasText: 'Mrs. S. Gunasekara' })).toContainText('Busy · 6B Science');
  await expect(clash.getByRole('button', { name: /Mrs\. S\. Gunasekara/ })).toHaveCount(0);
});
