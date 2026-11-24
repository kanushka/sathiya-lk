// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN, SID } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test('teacher view: pin a primary class by its own period times', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/s/${SID}/admin/timetable/teacher/t-wickramasinghe`);

  const slot = page.getByRole('button', { name: /^Monday, period 5, 10:50–11:30: empty/ });
  await slot.click();
  await page.getByRole('dialog', { name: 'Choose a subject' }).getByRole('listbox', { name: 'Subjects' }).getByRole('option', { name: /^English/ }).click();

  const picker = page.getByRole('dialog', { name: 'Choose a class' });
  const oneA = picker.getByRole('listbox', { name: 'Classes' }).getByRole('option', { name: /^1A/ });
  await expect(oneA).toContainText('Primary (Gr 1–2) template');
  await expect(oneA).toContainText('1A P5 · 10:40–11:05');
  await oneA.click();
  await expect(picker.getByText('Free: Mon 1A P5 · 10:40–11:05 (this row is P5 · 10:50–11:30).')).toBeVisible();
  await picker.getByRole('button', { name: 'Assign' }).click();
  await expect(picker).toBeHidden();

  const bar = page.getByRole('region', { name: 'Pin mode' });
  await expect(bar).toContainText('English · 1A');
  await expect(bar).toContainText('1 of 3 placed · 2 to go');
  await expect(page.getByRole('button', { name: /^Monday, period 5, 10:50–11:30: 1A English · 10:40–11:05, pinned, click to unpin$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Tuesday, period 5, 10:50–11:30: pin English for 1A, 1A P5 · 10:40–11:05$/ })).toBeVisible();
  for (const n of [6, 7, 8]) {
    const none = page.getByRole('button', { name: new RegExp(`^Tuesday, period ${n}, [0-9:–]+: no 1A period at this time$`) });
    await expect(none).toHaveAttribute('aria-disabled', 'true');
    await expect(none).toContainText('No 1A period');
  }

  await page.getByRole('button', { name: /^Tuesday, period 2, 08:30–09:10: pin English for 1A, 1A P2 · 08:20–09:00$/ }).click();
  await expect(page.getByRole('button', { name: /^Tuesday, period 2, 08:30–09:10: 1A English · 08:20–09:00, pinned, click to unpin$/ })).toBeVisible();
  await expect(page.getByText('English pinned to Tuesday, period 2.')).toBeVisible();
  await expect(bar).toContainText('2 of 3 placed · 1 to go');
  await shot(page, 'teacher-pin-mode');

  await bar.getByRole('button', { name: 'Done' }).click();
  await expect(bar).toBeHidden();
  await expect(page.getByRole('button', { name: 'Monday, period 5, 10:50–11:30: 1A English · 10:40–11:05' })).toBeVisible();

  await page.goto(`/s/${SID}/admin/timetable/class/c-1a`);
  await expect(page.getByRole('button', { name: 'Monday, period 5, 10:40–11:05: English Mrs. S. Wickramasinghe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tuesday, period 2, 08:20–09:00: English Mrs. S. Wickramasinghe' })).toBeVisible();
});
