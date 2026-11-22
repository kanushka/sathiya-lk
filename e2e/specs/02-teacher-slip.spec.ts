// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin, loginTeacher, pick, shot, SHOTS } from '../helpers';

type Printed = Window & { printed?: number };

const PASSWORD = /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/;

test('admin adds a teacher, sees the 8-character password and prints the login slip', async ({ page, browser }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await shot(page, 'admin-dashboard');
  await page.getByRole('link', { name: 'Teachers' }).click();
  await page.getByRole('button', { name: '+ Add teacher' }).click();

  const modal = page.getByRole('dialog', { name: 'Add teacher' });
  await expect(modal.getByLabel('Staff ID')).toHaveValue('SCC059');
  await pick(modal, 'Title', 'Mrs.');
  await modal.getByLabel('Name').fill('E. Tester');
  await pick(modal, 'Subjects', 'Mathematics');
  await page.keyboard.press('Escape');
  await modal.getByRole('group', { name: 'Grades' }).getByRole('button', { name: '6', exact: true }).click();
  await modal.getByRole('button', { name: 'Save teacher' }).click();

  const slip = modal.getByRole('region', { name: 'Login slip' });
  const pwText = slip.locator('b.font-mono');
  await expect(pwText).toBeVisible();
  const password = (await pwText.textContent())!.trim();
  expect(password).toMatch(PASSWORD);
  await expect(slip).toContainText('SCC059');
  await expect(slip).toContainText('Siripura Central College');

  await page.evaluate(() => {
    const win = window as Printed;
    const open = window.open.bind(window);
    window.open = (...args: Parameters<typeof window.open>) => {
      const w = open(...args);
      if (w) w.print = () => void (win.printed = (win.printed ?? 0) + 1);
      return w;
    };
  });
  const [popup] = await Promise.all([page.waitForEvent('popup'), slip.getByRole('button', { name: 'Print slip' }).click()]);
  await expect(popup.locator('article')).toHaveCount(1);
  const card = popup.locator('article');
  await expect(card.locator('h2')).toHaveText('Siripura Central College');
  await expect(card.locator('.name')).toHaveText('Mrs. E. Tester');
  await expect(card).toContainText('Staff ID: SCC059');
  await expect(card.locator('.pw')).toHaveText(password);
  await expect(card.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect(card.locator('.url')).toContainText('/login?as=teacher');
  await expect.poll(() => page.evaluate(() => (window as Printed).printed)).toBe(1);
  await popup.screenshot({ path: `${SHOTS}login-slip-print.png` });
  await popup.close();

  await modal.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('row', { name: /SCC059 Mrs\. E\. Tester/ })).toBeVisible();

  const teacher = await (await browser.newContext()).newPage();
  await loginTeacher(teacher, 'SCC059', password);
  await expect(teacher).toHaveURL(/\/me/);
  const row = page.getByRole('row', { name: /SCC059 Mrs\. E\. Tester/ });
  await expect(row).not.toContainText('Not logged in yet', { timeout: 15_000 });
});

test('slips need a fresh password and print-all explains it first', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Teachers' }).click();

  await page.getByRole('button', { name: 'Print all login slips' }).click();
  const printAll = page.getByRole('dialog', { name: 'Print login slips' });
  await expect(printAll.getByText(/only known right after/)).toBeVisible();
  await expect(printAll.getByRole('button', { name: /^Print 0 slips/ })).toBeDisabled();
  await printAll.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('row', { name: /SCC011/ }).getByRole('button', { name: 'Edit' }).click();
  const modal = page.getByRole('dialog', { name: 'Edit teacher' });
  await expect(modal.getByRole('button', { name: 'Print slip' })).toBeDisabled();
  await expect(modal.getByText('Reset the password first to print a slip')).toBeVisible();
  await modal.getByRole('button', { name: 'Reset password' }).click();
  const confirm = page.getByRole('dialog', { name: /Reset .*password\?/ });
  await expect(confirm.getByText(/current password stops working immediately/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Reset password' }).click();
  await expect(modal.locator('b.font-mono')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Print slip' })).toBeEnabled();
});

test('members list shows the admin name and email in their own columns', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Members' }).click();
  const row = page.getByRole('row', { name: new RegExp(ADMIN.name) });
  await expect(row).toContainText(ADMIN.email);
});
