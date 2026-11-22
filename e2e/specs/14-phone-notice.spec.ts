// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Locator } from '@playwright/test';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

// Chrome zooms the 1024px admin shell out on a phone, which trips Playwright's click hit-test; tap the real point instead.
async function tap(target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error('not visible');
  await target.page().touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test('admin on a phone sees the bigger-screen notice once, then a banner', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('dialog', { name: 'Best on a bigger screen' })).toHaveCount(0);

  await loginAdmin(page, ADMIN.email, ADMIN.password);
  const dialog = page.getByRole('dialog', { name: 'Best on a bigger screen' });
  await expect(dialog).toBeVisible();
  await shot(page, 'phone-notice-modal');
  await tap(dialog.getByRole('button', { name: 'Continue anyway' }));
  await expect(dialog).toHaveCount(0);

  const banner = page.getByText('Admin screens work best on a laptop, desktop or tablet.');
  await expect(banner).toBeVisible();
  await page.reload();
  await expect(banner).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Menu' })).toBeVisible();
  await shot(page, 'phone-notice-banner');

  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(banner).toHaveCount(0);
});
