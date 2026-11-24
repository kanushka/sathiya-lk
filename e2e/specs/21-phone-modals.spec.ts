// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin } from '../helpers';

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const W = 375;
const H = 812;

const cases: Array<[path: string, button: string, dialog: string | RegExp]> = [
  ['/admin', 'New year', 'New timetable year'],
  ['/admin', 'Publish to teachers', /^Publish the .* timetable\?$/],
  ['/admin/teachers', '+ Add teacher', 'Add teacher'],
  ['/admin/teachers', 'Import', 'Import subjects and teachers'],
  ['/admin/teachers', 'Print all login slips', /^(Print login slips|Reset every teacher’s password\?|Reset every teacher's password\?)$/],
  ['/admin/subjects', '+ Add subject', 'Add subject'],
  ['/admin/grades', '+ Add grade', 'Add grade'],
  ['/admin/grades', 'Custom plan', /^Custom plan for /],
  ['/admin/templates', '+ New template', 'New template'],
  ['/admin/members', 'Invite admin', 'Invite an admin'],
];

test('every admin pop-up opens as a full-width sheet on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  for (const [path, button, name] of cases) {
    await page.goto(path);
    await page.getByRole('button', { name: button, exact: true }).first().tap();
    const dialog = page.getByRole('dialog', { name });
    await expect(dialog, button).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x, button).toBe(0);
    expect(box.width, button).toBe(W);
    expect(Math.round(box.y + box.height), button).toBe(H);
    expect(box.y, button).toBeGreaterThanOrEqual(0);
    const overflowing = await dialog.evaluate((d) => {
      const vw = document.documentElement.clientWidth;
      return Array.from(d.querySelectorAll('*')).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > vw + 1 || r.left < -1);
      }).length;
    });
    expect(overflowing, button).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});
