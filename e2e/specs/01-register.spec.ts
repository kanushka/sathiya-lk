// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { admin } from '../../scripts/seed';
import { pick, shot } from '../helpers';

async function verifyLinkFromMail(email: string): Promise<string> {
  const { db } = admin();
  let link: string | undefined;
  await expect
    .poll(async () => {
      const snap = await db.collection('mail').where('to', 'array-contains', email).get();
      const text = snap.docs.map((d) => String(d.get('message.text') ?? '')).join('\n');
      link = text.match(/https?:\/\/\S*mode=verifyEmail\S*/)?.[0];
      return link;
    })
    .toBeTruthy();
  return link!;
}

test('register a government school: census lookup, email verification gate, lands on /admin', async ({ page, context }) => {
  const email = `principal-${Date.now()}@example.com`;
  await page.goto('/register');
  await shot(page, 'register-step1');
  await page.getByRole('button', { name: 'Find my school' }).click();
  await expect(page.getByText('Enter the census number, or choose "My school isn\'t listed" below.')).toBeVisible();
  await page.getByLabel('Census number').fill('54321');
  await page.getByRole('button', { name: 'Find my school' }).click();

  await expect(page.getByRole('heading', { name: '1 · School details' })).toBeVisible();
  await expect(page.getByText("Census number 54321 isn't in the Ministry of Education school list.")).toBeVisible();
  await expect(page.getByLabel('Census number', { exact: true })).toHaveValue('54321');
  await expect(page.getByRole('combobox', { name: 'School type' })).toContainText('Government');
  await expect(page.getByRole('checkbox', { name: /No census number/ })).toBeDisabled();
  const next = page.getByRole('button', { name: 'Next: logo & colours' });
  await page.getByLabel('School name in English').fill('Nugegoda Central College');
  await page.getByLabel('City', { exact: true }).fill('Nugegoda');
  await pick(page, /^District/, 'Colombo');
  await expect(page.getByLabel('Staff ID prefix')).toHaveValue('NCC');
  await page.getByLabel('Census number', { exact: true }).fill('12');
  await expect(page.getByText('Census number must be 4 to 6 digits')).toBeVisible();
  await expect(next).toBeDisabled();
  await page.getByLabel('Census number', { exact: true }).fill('54321');
  await expect(page.getByText('Census number must be 4 to 6 digits')).toBeHidden();
  await next.click();

  await shot(page, 'register-step2');
  await page.getByRole('button', { name: 'Next: your account' }).click();
  await page.getByLabel('Your name').fill('Mrs. P. Principal');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('principal-1');
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await shot(page, 'register-step3');
  await page.getByRole('button', { name: 'Create school' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await shot(page, 'register-verify-gate');
  await page.getByRole('button', { name: "I've confirmed it" }).click();
  await expect(page.getByText('Not verified yet.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  const link = await verifyLinkFromMail(email);
  const code = new URL(link).searchParams.get('oobCode');
  const inbox = await context.newPage();
  await inbox.goto(`/auth/action?mode=verifyEmail&oobCode=${code}`);
  await expect(inbox.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();
  await inbox.close();

  await page.getByRole('button', { name: "I've confirmed it" }).click();
  await expect(page.getByRole('heading', { name: '3 · Your admin account' })).toBeVisible();
  await page.getByRole('button', { name: 'Create school' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('navigation', { name: 'Menu' })).toContainText('Nugegoda Central College');
});
