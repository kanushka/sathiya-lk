// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { SUPER } from '../../scripts/seed';
import { freshSchoolAdmin, loginAdmin, shot } from '../helpers';

test('super admin suspends a squatting school and releases its census number for the real school', async ({ page }) => {
  const censusNo = String(100_000 + (Date.now() % 900_000));
  const squatter = await freshSchoolAdmin('Squatter', { type: 'government', censusNo });
  await expect(freshSchoolAdmin('Realschool', { type: 'government', censusNo })).rejects.toThrow(/census-taken/);

  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  await page.goto(`/super/schools/${squatter.sid}`);
  await expect(page.getByRole('heading', { name: 'Squatter School' })).toBeVisible();
  await page.getByRole('button', { name: 'Disable' }).click();
  await page.getByRole('dialog', { name: 'Disable Squatter School?' }).getByRole('button', { name: 'Disable school' }).click();
  await expect(page.getByText('Squatter School disabled')).toBeVisible();

  await page.getByRole('button', { name: 'Release census number' }).click();
  const confirm = page.getByRole('dialog', { name: `Release census number ${censusNo}?` });
  await expect(confirm).toContainText(`removes census number ${censusNo} from Squatter School`);
  await shot(page, 'super-release-census');
  await confirm.getByRole('button', { name: `Release ${censusNo}` }).click();
  await expect(page.getByText(`Census number ${censusNo} released from Squatter School`)).toBeVisible();
  await expect(page.getByText('Census number released')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Release census number' })).toBeHidden();

  const real = await freshSchoolAdmin('Realschool', { type: 'government', censusNo });
  expect(real.sid).not.toBe(squatter.sid);
});
