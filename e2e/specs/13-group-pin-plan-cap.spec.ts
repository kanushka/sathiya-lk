// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { C } from '@sathiya/core/fixtures';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin } from '../helpers';

test('class view: a class that already has the group’s target is not offered to join', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/admin/timetable/class/${C.c6a}`);

  await page.getByRole('button', { name: 'Pin Aesthetic' }).click();
  const group = page.getByRole('dialog', { name: 'Set teachers for Aesthetic' });
  await expect(group.getByText('Classes together')).toBeVisible();
  await expect(group.getByRole('button', { name: '6B already has 3/3' })).toBeDisabled();
});
