// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin, loginTeacher, shot, SHOTS } from '../helpers';

type Printed = Window & { printed?: number };

const PASSWORD = /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/;

test('admin adds a teacher, sees the 8-character password and prints the login slip', async ({ page, browser }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await shot(page, 'admin-dashboard');
  await page.getByRole('link', { name: 'Teachers' }).click();
  await page.getByRole('button', { name: '+ Add teacher' }).click();

  const modal = page.getByRole('dialog', { name: 'Add teacher' });
  await expect(modal.getByLabel('Staff ID')).toHaveValue('SCC059');
  await modal.getByLabel('Title').selectOption('Mrs');
  await modal.getByLabel('Name').fill('E. Tester');
  await modal.getByRole('button', { name: 'Mathematics' }).click();
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
});
