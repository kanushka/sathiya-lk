// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { paths } from '@sathiya/core';
import { entries, shortFridayTemplate, TPL } from '@sathiya/core/fixtures';
import { ADMIN, admin, SID, YEAR_ID } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

const templateDoc = () => admin().db.doc(`${paths.templates(SID)}/${TPL.shortFriday}`);
const orphan = entries.find((e) => e.id === 'e-6c-4-7')!;

test.beforeAll(async () => {
  await templateDoc().update({ 'days.4': shortFridayTemplate.rows.slice(0, -3) });
});

test.afterAll(async () => {
  const { id, ...rest } = orphan;
  await templateDoc().update({ 'days.4': shortFridayTemplate.days![4] });
  await admin().db.doc(`${paths.entries(SID, YEAR_ID)}/${id}`).set(rest);
});

test('orphaned entry: follow Needs attention to the class, delete it, warning clears', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  const warning = page.getByRole('link', { name: /6C Friday P7 is outside the period template/ });
  await expect(warning).toBeVisible();
  await warning.click();

  await expect(page).toHaveURL(/\/admin\/timetable\/class\/c-6c#outside-template$/);
  const list = page.getByRole('region', { name: 'Outside the period template' });
  await expect(list).toBeInViewport();
  await expect(list).toContainText('Fri P7 · 6C · Science · Mrs. S. Gunasekara');
  await shot(page, 'orphan-list');

  await list.getByRole('button', { name: 'Delete Fri P7 Science' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete this entry?' });
  await expect(confirm).toContainText('Fri P7 · 6C · Science');
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(confirm).toBeHidden();
  await expect(list).toBeHidden();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await expect(page.getByRole('link', { name: /outside the period template/ })).toHaveCount(0);
});
