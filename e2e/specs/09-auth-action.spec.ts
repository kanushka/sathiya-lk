// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { admin } from '../../scripts/seed';
import { idToken, oobCodeOf } from '../helpers';

test.describe('/auth/action', () => {
  test('verifyEmail confirms the address', async ({ page }) => {
    const { auth } = admin();
    const email = `verify-${Date.now()}@example.com`;
    const user = await auth.createUser({ email, password: 'verify-pass-1' });
    const code = oobCodeOf(await auth.generateEmailVerificationLink(email));

    await page.goto(`/auth/action?mode=verifyEmail&oobCode=${code}`);
    await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
    expect((await auth.getUser(user.uid)).emailVerified).toBe(true);

    await page.goto(`/auth/action?mode=verifyEmail&oobCode=${code}`);
    await expect(page.getByRole('heading', { name: 'Link problem' })).toBeVisible();
    await expect(page.getByText('This link has already been used or is not valid.', { exact: false })).toBeVisible();
  });

  test('resetPassword sets a new password', async ({ page }) => {
    const { auth } = admin();
    const email = `reset-${Date.now()}@example.com`;
    await auth.createUser({ email, password: 'old-pass-1', emailVerified: true });
    const code = oobCodeOf(await auth.generatePasswordResetLink(email));

    await page.goto(`/auth/action?mode=resetPassword&oobCode=${code}`);
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await page.getByLabel('New password', { exact: true }).fill('new-pass-1');
    await page.getByLabel('Confirm new password').fill('new-pass-2');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByText("Passwords don't match")).toBeVisible();
    await page.getByLabel('Confirm new password').fill('new-pass-1');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible();

    await expect(idToken(email, 'new-pass-1')).resolves.toBeTruthy();
    await expect(idToken(email, 'old-pass-1')).rejects.toThrow(/INVALID/);
  });

  test('an invalid code shows the error state', async ({ page }) => {
    await page.goto('/auth/action?mode=resetPassword&oobCode=not-a-real-code');
    await expect(page.getByRole('heading', { name: 'Link problem' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to login' })).toBeVisible();
  });
});
