// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { T } from '@sathiya/core/fixtures';
import { ADMIN, SID, teacherLogin, YEAR_ID } from '../../scripts/seed';
import { callAs, idToken, loginTeacher, shot } from '../helpers';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('teacher signs in on a phone and sees the current lesson', async ({ page }) => {
  await callAs(await idToken(ADMIN.email, ADMIN.password), 'publishYear', { schoolId: SID, yearId: YEAR_ID });
  // Monday 08:00 in Asia/Colombo: period 1 (07:45–08:30), Mrs. N. Perera teaches Maths in 6B.
  await page.clock.setFixedTime(new Date('2026-11-23T08:00:00+05:30'));

  const perera = teacherLogin(T.perera);
  await page.goto('/login?as=teacher');
  await shot(page, 'login-mobile');
  await loginTeacher(page, perera.staffId, perera.password);
  await expect(page.getByRole('banner')).toContainText('Mrs. N. Perera · SCC024');
  await expect(page.getByRole('banner')).toContainText('Monday 23 November');
  const main = page.getByRole('main');
  await expect(main).toContainText(/NOW · P1\s*7:45 – 8:30 · 30 min left/);
  await expect(main.getByText('Mathematics · 6B')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await shot(page, 'teacher-me-mobile');
});
