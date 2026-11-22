// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { T } from '@sathiya/core/fixtures';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test('teacher view: build a religion block through the block editor', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'By teacher' }).click();
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  await page.getByRole('option', { name: /Ven\. Ananda Thero/ }).click();
  await expect(page).toHaveURL(/\/admin\/timetable\/teacher\/t-ananda$/);
  await expect(page.getByRole('meter', { name: 'Tuesday load' })).toHaveAttribute('aria-valuetext', '0/6');

  const slot = page.getByRole('button', { name: /^Tuesday, period 2, 08:30–09:10: empty/ });
  await slot.click();
  await slot.press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Subject' }).click();
  await page.getByRole('option', { name: 'Buddhism' }).click();
  const classes = page.getByRole('dialog', { name: 'Choose a class' });
  await expect(classes.getByRole('button', { name: /^6B Religion block · 6B · Mathematics · Mrs\. N\. Perera/ })).toBeDisabled();
  await classes.getByRole('button', { name: /^6C Religion block/ }).click();

  const block = page.getByRole('dialog', { name: 'Religion' });
  await expect(block.getByRole('combobox', { name: 'Buddhism' })).toHaveValue(T.ananda);
  await expect(block.getByRole('combobox', { name: 'Buddhism' }).getByRole('option', { name: /M\. Silva/ })).toHaveCount(0);
  await block.getByRole('combobox', { name: 'Catholicism' }).selectOption(T.mSilva);
  await block.getByRole('combobox', { name: 'Islam' }).selectOption(T.rizan);
  await shot(page, 'block-editor');
  await block.getByRole('button', { name: 'Save' }).click();
  await expect(block).toBeHidden();

  await expect(page.getByRole('button', { name: 'Tuesday, period 2, 08:30–09:10: ⧉ 6C Buddhism' })).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Tuesday load' })).toHaveAttribute('aria-valuetext', '1/6');
  await shot(page, 'teacher-view');

  await page.goto('/admin/timetable/class/c-6c');
  await expect(page.getByRole('button', { name: /^Tuesday, period 2, 08:30–09:10: Religion/ })).toBeVisible();
});
