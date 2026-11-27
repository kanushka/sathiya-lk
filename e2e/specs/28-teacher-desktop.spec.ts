// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { paths } from '@sathiya/core';
import { C, T } from '@sathiya/core/fixtures';
import { SID, teacherLogin } from '../../scripts/seed';
import { loginTeacher, shot } from '../helpers';
import { publishFixtureTimetable, reliefDays, setField, TEACHER_NOW, TODAY, TOMORROW, writeReliefDays } from '../teacherData';

const restores: Array<() => Promise<void>> = [];
test.beforeAll(async () => {
  restores.push(await publishFixtureTimetable());
  restores.push(await setField(`${paths.classes(SID)}/${C.c6b}`, 'classTeacherId', T.perera));
  restores.push(await writeReliefDays(reliefDays));
});
test.afterAll(async () => {
  for (const undo of restores.splice(0).reverse()) await undo();
});

test('teacher on a desktop: tabs in the top bar, the week beside today, my class and its print guard', async ({ page }) => {
  await page.clock.setFixedTime(TEACHER_NOW);
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  const perera = teacherLogin(T.perera);
  await loginTeacher(page, perera.email, perera.password);
  const nav = page.getByRole('banner').getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Today', 'Timetable', 'My class', 'Me']);
  const main = page.getByRole('main');

  const week = main.getByRole('region', { name: 'This week' });
  await expect(week.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
  await expect(week.getByTestId(`cell-${TODAY}-3`)).toContainText('6B');
  await expect(week.getByTestId(`cell-${TODAY}-6`)).toContainText('Relief');
  await expect(week.getByTestId(`cell-${TOMORROW}-5`)).toContainText('Relief');
  await expect(main.getByRole('region', { name: /Relief today/ })).toContainText('6B · Sinhala');
  await expect(main.getByRole('region', { name: /^Tomorrow/ })).toContainText('Covering for Ms. A. Wijesekara');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  await shot(page, 'teacher-desktop-today');

  await nav.getByRole('link', { name: 'My class' }).click();
  await expect(main.getByTestId(`cell-${TODAY}-6`)).toContainText('Relief: Mrs. N. Perera');
  await expect(main.getByTestId(`cell-${TODAY}-8`)).toContainText('No relief yet');
  await shot(page, 'teacher-desktop-my-class');
  await main.getByRole('link', { name: 'Print 6B timetable' }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${SID}/me/print/class/${C.c6b}\\?auto=1$`));
  await expect(page.getByRole('heading', { name: /6B/ }).first()).toBeVisible();

  await page.goto(`/s/${SID}/me/print/class/${C.c6a}`);
  await expect(page.getByText('Class not found')).toBeVisible();
});
