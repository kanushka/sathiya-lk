// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN, SID } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test('teacher view: build a religion block through the assign popup', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'By teacher' }).click();
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  await page.getByRole('option', { name: /Ven\. Ananda Thero/ }).click();
  await expect(page).toHaveURL(/\/admin\/timetable\/teacher\/t-ananda$/);
  await expect(page.getByRole('meter', { name: 'Tuesday load' })).toHaveAttribute('aria-valuetext', '0/6');

  const slot = page.getByRole('button', { name: /^Tuesday, period 2, 08:30–09:10: empty/ });
  await slot.click();
  const subjects = page.getByRole('dialog', { name: 'Choose a subject' });
  await subjects.getByRole('listbox', { name: 'Subjects' }).getByRole('option', { name: /^Buddhism/ }).click();

  const classes = page.getByRole('dialog', { name: 'Choose a class' }).getByRole('listbox', { name: 'Classes' });
  await expect(classes.getByRole('option', { name: /^6B · Religion \(Buddhism\)/ })).toContainText('Busy · 6B · Mathematics · Mrs. N. Perera');
  await classes.getByRole('option', { name: /^6C · Religion \(Buddhism\)/ }).click();

  const group = page.getByRole('dialog', { name: 'Set teachers for Religion' });
  await expect(group.getByText('This teacher').locator('xpath=ancestor::li[1]')).toContainText('Ven. Ananda Thero');
  await group.getByRole('button', { name: /^Catholicism teacher:/ }).click();
  await group.getByRole('combobox', { name: 'Search Catholicism teachers' }).fill('M. Silva');
  await group.getByRole('listbox', { name: 'Catholicism teachers' }).getByRole('option', { name: /M\. Silva/ }).click();
  await group.getByRole('button', { name: /^Islam teacher:/ }).click();
  await group.getByRole('combobox', { name: 'Search Islam teachers' }).fill('Rizan');
  await group.getByRole('listbox', { name: 'Islam teachers' }).getByRole('option', { name: /Rizan/ }).click();
  await expect(group.getByText('All 3 teachers and 6C are free on Tue 6C P2.')).toBeVisible();
  await shot(page, 'teacher-assign-group');
  await group.getByRole('button', { name: 'Assign' }).click();
  await expect(group).toBeHidden();

  const bar = page.getByRole('region', { name: 'Pin mode' });
  await expect(bar).toContainText('Religion · 6C');
  await expect(page.getByRole('button', { name: /^Tuesday, period 2, 08:30–09:10: Religion 6C, pinned, click to unpin$/ })).toBeVisible();
  await shot(page, 'teacher-group-pin-mode');
  await bar.getByRole('button', { name: 'Done' }).click();
  await expect(bar).toBeHidden();

  await expect(page.getByRole('button', { name: 'Tuesday, period 2, 08:30–09:10: ⧉ 6C Buddhism' })).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Tuesday load' })).toHaveAttribute('aria-valuetext', '1/6');
  await shot(page, 'teacher-view');

  await page.goto(`/s/${SID}/admin/timetable/class/c-6c`);
  await expect(page.getByRole('button', { name: /^Tuesday, period 2, 08:30–09:10: Religion/ })).toBeVisible();
});
