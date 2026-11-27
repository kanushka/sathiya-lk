// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Page } from '@playwright/test';
import { ADMIN, SID } from '../../scripts/seed';
import { loginAdmin } from '../helpers';

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

const W = 375;
const H = 812;

type Open = (page: Page) => Promise<void>;
const tapButton = (name: string): Open => (page) => page.getByRole('button', { name, exact: true }).first().tap();
const fromMenu = (menu: string, item: string): Open => async (page) => {
  await page.getByRole('button', { name: menu }).first().tap();
  await page.getByRole('menuitem', { name: item }).tap();
};

const cases: Array<[path: string, label: string, dialog: string | RegExp, open?: Open]> = [
  ['/admin', 'New year', 'New timetable year'],
  ['/admin', 'Publish to teachers', /^Publish the .* timetable\?$/],
  ['/admin/teachers', '+ Add teacher', 'Add teacher'],
  ['/admin/teachers', 'Import', 'Import subjects and teachers', fromMenu('More teacher actions', 'Import')],
  [
    '/admin/teachers',
    'Unlink',
    /^Unlink .*\?$/,
    async (page) => {
      await page.getByRole('region', { name: /^Linked/ }).getByRole('button', { name: /^Edit / }).first().tap();
      await fromMenu('More actions for this teacher', 'Unlink')(page);
    },
  ],
  ['/admin/subjects', '+ Add subject', 'Add subject'],
  ['/admin/grades', '+ Add grade', 'Add grade'],
  [
    '/admin/grades',
    'Custom plan',
    /^Custom plan for /,
    async (page) => {
      await page.getByText('Classes and staffing').tap();
      await tapButton('Custom plan')(page);
    },
  ],
  ['/admin/templates', '+ New template', 'New template'],
  ['/admin/members', 'Invite admin', 'Invite an admin'],
];

test('every admin pop-up opens as a full-width sheet on a phone', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  for (const [path, button, name, open] of cases) {
    await page.goto(`/s/${SID}${path}`);
    await (open ?? tapButton(button))(page);
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
    const clipped = await dialog.evaluate((d) =>
      [d, ...Array.from(d.children)].filter((el) => el.scrollWidth > el.clientWidth + 1).length,
    );
    expect(clipped, button).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});
