// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { paths } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { admin, PENDING_SCHOOL, SID, SUPER } from '../../scripts/seed';
import { loginAdmin, shot } from '../helpers';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

// Spec 24 rejects the seeded pending school earlier in the run, which also releases its census number.
// Put it back the way the seed left it, so the review card and Release census number are there to check.
test.beforeAll(async () => {
  const { db } = admin();
  await db.doc(paths.school(PENDING_SCHOOL.sid)).update({
    status: 'pending',
    review: { moeMatched: false },
    censusNo: PENDING_SCHOOL.censusNo,
    releasedCensusNo: FieldValue.delete(),
    censusReleasedAt: FieldValue.delete(),
    censusReleasedBy: FieldValue.delete(),
  });
  await db.doc(paths.censusIndex(PENDING_SCHOOL.censusNo)).set({ schoolId: PENDING_SCHOOL.sid });
});

const pages: Array<[string, string]> = [
  ['/super', 'schools'],
  [`/super/schools/${PENDING_SCHOOL.sid}`, 'school-review'],
  [`/super/schools/${SID}`, 'school-detail'],
  ['/super/reports', 'reports'],
  ['/super/usage', 'usage'],
  ['/super/subjects', 'subjects'],
  ['/super/terms', 'terms'],
  ['/super/announcements', 'announcements'],
];

test('every super admin page fits a phone without sideways scrolling', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  for (const [path, name] of pages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
    await shot(page, `phone-super-${name}`);
  }
});

test('the super admin menu moves between pages', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Sathiya' });
  await expect(menu.getByRole('link', { name: 'Schools' })).toHaveAttribute('aria-current', 'page');
  await shot(page, 'phone-super-menu');
  await menu.getByRole('link', { name: 'Usage' }).click();
  await expect(page).toHaveURL(/\/super\/usage$/);
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Usage', level: 1 })).toBeVisible();
});

test('approve and reject sit at the bottom of the review card on a phone', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  await page.goto(`/super/schools/${PENDING_SCHOOL.sid}`);
  const card = page.getByRole('region', { name: 'Review' });
  const approve = card.getByRole('button', { name: 'Approve school' });
  const reject = card.getByRole('button', { name: 'Reject…' });
  await expect(approve).toBeVisible();
  const [a, r, reg] = await Promise.all([approve.boundingBox(), reject.boundingBox(), card.getByText('Registered by').boundingBox()]);
  expect(a!.height).toBeGreaterThanOrEqual(44);
  expect(a!.x).toBeLessThan(r!.x);
  expect(a!.y).toBeGreaterThan(reg!.y);
});

test('schools are grouped by status and the school page keeps secondary actions under ⋯', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  const review = page.getByRole('region', { name: /Needs review/ });
  await expect(review.getByRole('button', { name: `Review: ${PENDING_SCHOOL.nameEn}` })).toBeVisible();
  await review.getByRole('button', { name: `Review: ${PENDING_SCHOOL.nameEn}` }).click();
  await expect(page).toHaveURL(new RegExp(`/super/schools/${PENDING_SCHOOL.sid}$`));
  await page.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Release census number' })).toBeVisible();
  await shot(page, 'phone-super-school-menu');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Open read-only view' })).toHaveAttribute('href', `/super/schools/${PENDING_SCHOOL.sid}/admin`);
});

test('a report opens as a sheet from the phone list and closes from its row', async ({ page }) => {
  const ref = admin().db.doc('reports/e2e-phone-report');
  await ref.set({ schoolId: SID, reason: 'duplicate', details: 'Looks like a second account.', createdAt: Date.now(), status: 'open' });
  try {
    await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
    await page.goto('/super/reports');
    const list = page.getByRole('region', { name: /^Open/ });
    const row = list.getByRole('listitem').filter({ hasText: 'Siripura Central College' });
    await row.getByRole('button', { name: /Siripura Central College/ }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Siripura Central College' });
    await expect(sheet.getByText('Looks like a second account.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Suspend school' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await shot(page, 'phone-super-report-sheet');
    await sheet.getByRole('button', { name: 'Close report' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'No open reports' })).toBeVisible();
  } finally {
    await ref.delete();
  }
});
