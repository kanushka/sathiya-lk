// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { SUPER } from '../../scripts/seed';
import { freshSchoolAdmin, loginAdmin, shot } from '../helpers';

test('super admin suspends a reported school and closes the report', async ({ page, browser }) => {
  await freshSchoolAdmin('Fakeville');

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto('/login?report=1');
  const report = visitor.getByRole('dialog', { name: 'Report a school' });
  await report.getByRole('combobox', { name: 'School' }).fill('Fakevil');
  await visitor.getByRole('option', { name: /Fakeville School, Colombo/ }).click();
  await report.getByRole('radio', { name: 'Not the real school / fake' }).check();
  await report.getByLabel('Details (optional)').fill('Not a real school, registered as a test.');
  await report.getByLabel('Your email (optional, so we can reply)').fill('parent@example.com');
  await report.getByRole('button', { name: 'Send report' }).click();
  await expect(visitor.getByText('Report sent. Thank you.')).toBeVisible();

  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  const row = page.getByRole('row', { name: /^Fakeville School/ });
  await expect(row).toContainText('Active');
  await expect(page.getByRole('row', { name: /^Siripura Central College/ })).toBeVisible();
  await shot(page, 'super-schools');
  await row.getByRole('button', { name: 'Disable' }).click();
  await page.getByRole('dialog', { name: 'Disable Fakeville School?' }).getByRole('button', { name: 'Disable school' }).click();
  await expect(page.getByText('Fakeville School disabled')).toBeVisible();
  await expect(row).toContainText('Disabled');
  await expect(row.getByRole('button', { name: 'Enable' })).toBeVisible();

  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page).toHaveURL(/\/super\/reports$/);
  const open = page.getByRole('row', { name: /Fakeville School/ });
  await expect(open).toContainText('Fake school');
  await expect(open).toContainText('Not a real school, registered as a test.');
  await expect(open).toContainText('parent@example.com');
  await shot(page, 'super-reports');
  await open.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Report closed')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No open reports' })).toBeVisible();
});
