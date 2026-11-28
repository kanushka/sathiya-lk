// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Page } from '@playwright/test';
import { paths } from '@sathiya/core';
import { C, T } from '@sathiya/core/fixtures';
import { SID, teacherLogin } from '../../scripts/seed';
import { loginTeacher, shot } from '../helpers';
import { publishFixtureTimetable, reliefDays, setField, TEACHER_NOW, TODAY, TOMORROW, writeReliefDays } from '../teacherData';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

// The spec publishes the fixture timetable, makes Mrs. N. Perera class teacher of 6B and writes relief for two dates
// no other spec uses, then puts every doc back, so it runs the same alone or after the others.
const restores: Array<() => Promise<void>> = [];
test.beforeAll(async () => {
  restores.push(await publishFixtureTimetable());
  restores.push(await setField(`${paths.classes(SID)}/${C.c6b}`, 'classTeacherId', T.perera));
  restores.push(await writeReliefDays(reliefDays));
});
test.afterAll(async () => {
  for (const undo of restores.splice(0).reverse()) await undo();
});

const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });

test('teacher on a phone: today, timetable, my class and me', async ({ page }) => {
  await page.clock.setFixedTime(TEACHER_NOW);
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  const perera = teacherLogin(T.perera);
  await loginTeacher(page, perera.email, perera.password);
  const main = page.getByRole('main');

  await expect(main.getByRole('heading', { name: 'Good morning, Mrs. N. Perera' })).toBeVisible();
  await expect(main.getByTestId('now-card')).toContainText(/NOW · P3\s*9:10–9:50 · 30 min left/);
  await expect(main.getByRole('region', { name: /Relief today/ })).toContainText('Covering for Mr. R. Silva');
  await expect(main.getByRole('region', { name: 'Rest of today' })).toContainText('6A · Mathematics');
  await expect(main).toContainText('Tomorrow: 1 relief period planned');
  await expect(tab(page, 'Today')).toHaveAttribute('aria-current', 'page');
  await noSideScroll(page);
  await shot(page, 'teacher-phone-today');

  await tab(page, 'Timetable').click();
  await expect(main.getByRole('radio', { name: '3 days' })).toHaveAttribute('aria-checked', 'true');
  await expect(main).toContainText('Wed 4 – Fri 6 March');
  await expect(main.getByTestId(`cell-${TODAY}-6`)).toContainText('Relief');
  await expect(main.getByTestId(`cell-${TOMORROW}-5`)).toContainText('Relief');
  await noSideScroll(page);
  await shot(page, 'teacher-phone-3days');
  await main.getByRole('button', { name: 'Later' }).click();
  await expect(main).toContainText('Thu 5 – Mon 9 March');
  await main.getByRole('radio', { name: 'Week' }).click();
  await main.getByTestId(`cell-${TODAY}-6`).getByRole('button').click();
  await expect(page.getByRole('dialog', { name: '6B · Sinhala' })).toContainText('for Mr. R. Silva');
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
  await noSideScroll(page);
  await shot(page, 'teacher-phone-week');

  await tab(page, 'My class').click();
  await expect(main.getByRole('heading', { name: '6B' })).toBeVisible();
  const day = main.getByRole('list', { name: 'Periods' });
  await expect(day.getByRole('listitem').filter({ hasText: 'P6' })).toContainText('Relief: Mrs. N. Perera');
  await expect(day.getByRole('listitem').filter({ hasText: 'P8' })).toContainText('No relief yet');
  await expect(day.getByRole('listitem').filter({ hasText: 'P1' })).toContainText('Ms. A. Wijesekara');
  await noSideScroll(page);
  await shot(page, 'teacher-phone-my-class');

  await tab(page, 'Me').click();
  const details = main.getByRole('region', { name: 'My details' });
  await expect(details).toContainText('SCC024');
  await expect(details).toContainText(perera.email);
  await expect(main).toContainText('To change your name, staff ID or email, ask your school admin.');
  await expect(main.getByRole('region', { name: 'This year' })).toContainText('Classes I teach');
  await expect(main.getByLabel('Phone number')).toBeEditable();
  await noSideScroll(page);
  await shot(page, 'teacher-phone-me');

  await main.getByRole('link', { name: 'Print timetable' }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${SID}/me/print/timetable\\?auto=1$`));
  await expect(page.getByRole('heading', { name: 'Mrs. N. Perera · SCC024' })).toBeVisible();
});
