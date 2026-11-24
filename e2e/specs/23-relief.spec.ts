// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { T } from '@sathiya/core/fixtures';
import { ADMIN, SID, teacherLogin, YEAR_ID } from '../../scripts/seed';
import { callAs, idToken, loginAdmin, loginTeacher, shot } from '../helpers';

const colombo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const part = (type: string) => colombo.find((p) => p.type === type)!.value;
const today = `${part('year')}-${part('month')}-${part('day')}`;

test.skip(['Sat', 'Sun'].includes(part('weekday')), 'relief is only planned on school days (the server checks the real Colombo date)');

test.beforeAll(async () => {
  await callAs(await idToken(ADMIN.email, ADMIN.password), 'publishYear', { schoolId: SID, yearId: YEAR_ID });
});

test('admin plans relief for a teacher on leave and the relief teacher sees it today', async ({ page, browser }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Relief' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/s/${SID}/admin/relief$`));
  await expect(page.getByRole('heading', { name: 'Relief', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: '+ Add teacher' }).click();
  await page.getByRole('option', { name: /A\. Wijesekara/ }).click();
  const leave = page.getByRole('group', { name: /A\. Wijesekara/ });
  await expect(leave.getByRole('button', { name: 'Full day' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Suggest relief' }).click();
  const pickRelief = page.getByRole('button', { name: /^Relief for .*: / });
  await expect(pickRelief).toHaveCount(1);

  const perera = teacherLogin(T.perera);
  await pickRelief.click();
  await page.getByRole('dialog', { name: 'Choose relief teacher' }).getByRole('button', { name: /N\. Perera/ }).click();
  await expect(pickRelief).toContainText('N. Perera');

  await page.getByRole('button', { name: 'Save & notify' }).click();
  await expect(page.getByRole('status')).toContainText('1 teacher will be emailed');
  await shot(page, 'relief-saved');

  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await page.getByRole('link', { name: 'Print' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/print/relief/${today}$`));
  await expect(page.getByRole('heading', { name: 'Relief periods' })).toBeVisible();
  await expect(page.getByText(/Wijesekara/).first()).toBeVisible();
  await expect(page.getByText(/Perera/).first()).toBeVisible();
  await shot(page, 'relief-print');

  const teacher = await (await browser.newContext()).newPage();
  await loginTeacher(teacher, perera.email, perera.password);
  const main = teacher.getByRole('main');
  await expect(main.getByText('Relief', { exact: true }).first()).toBeVisible();
  await expect(main).toContainText(/for .*Wijesekara/);
});
