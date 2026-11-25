// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Browser, type Page } from '@playwright/test';
import { admin, PENDING_ADMIN, PENDING_SCHOOL, SUPER } from '../../scripts/seed';
import { clearRateLimits, loginAdmin, pick, shot, signIn } from '../helpers';

test.describe.configure({ mode: 'serial' });

const BANNER = 'Your school is under review.';
const LOCKED = 'Available after Sathiya approves your school.';

async function verifiedUser(tag: string): Promise<{ email: string; password: string }> {
  const email = `${tag}-${Date.now()}@example.com`;
  const password = 'review-pass-1';
  await admin().auth.createUser({ email, password, emailVerified: true, displayName: `${tag} principal` });
  return { email, password };
}

async function startRegistration(browser: Browser, tag: string): Promise<Page> {
  const { email, password } = await verifiedUser(tag);
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/start$/);
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: '1 · Find your school' })).toBeVisible();
  return page;
}

async function finishRegistration(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Next: your account' }).click();
  await expect(page.getByRole('heading', { name: '3 · Your admin account' })).toBeVisible();
  await page.getByLabel('Your name').fill('Mrs. P. Principal');
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.getByRole('button', { name: 'Create school' }).click();
  await expect(page).toHaveURL(/\/s\/[^/]+\/admin$/);
  return page.url().match(/\/s\/([^/]+)\/admin$/)![1]!;
}

const statusOf = async (sid: string) => (await admin().db.doc(`schools/${sid}`).get()).get('status') as string;

let pendingSid = '';
let pendingName = '';
let pendingPage: Page;

test.beforeAll(clearRateLimits);

test('a listed census number registers the official school, active at once', async ({ browser }) => {
  const page = await startRegistration(browser, 'kotahena');
  await page.getByLabel('Census number').fill('23');
  await page.getByRole('button', { name: 'Find my school' }).click();

  await expect(page.getByRole('heading', { name: 'Is this your school?' })).toBeVisible();
  await expect(page.getByText('Census number 00023 is in the Ministry of Education school list.')).toBeVisible();
  await expect(page.getByText('Kotahena M.M.V.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('School name in English')).toBeDisabled();
  await page.getByLabel('School name in Sinhala').fill('කොටහේන මධ්‍ය මහා විද්‍යාලය');
  await shot(page, 'register-census-confirm');
  await page.getByRole('button', { name: 'Yes, this is my school · Next: logo & colours' }).click();

  const sid = await finishRegistration(page);
  await expect(page.getByRole('navigation', { name: 'Menu' })).toContainText('Kotahena M.M.V.');
  await expect(page.getByText(BANNER)).toBeHidden();
  expect(await statusOf(sid)).toBe('active');
  await page.context().close();
});

test('a school that is not listed registers as pending: banner, publish locked', async ({ browser }) => {
  pendingName = `Ambewela Private School ${Date.now() % 100_000}`;
  const page = await startRegistration(browser, 'ambewela');
  await page.getByRole('button', { name: "My school isn't listed / no census number" }).click();

  await expect(page.getByRole('heading', { name: '1 · School details' })).toBeVisible();
  await expect(page.getByText("Registering a school that isn't in the MOE school list.")).toBeVisible();
  await pick(page, 'School type', 'Private');
  await page.getByRole('checkbox', { name: /No census number/ }).check();
  await page.getByLabel('School name in English').fill(pendingName);
  await page.getByLabel('City', { exact: true }).fill('Ambewela');
  await pick(page, /^District/, 'Nuwara Eliya');
  await page.getByRole('button', { name: 'Next: logo & colours' }).click();

  pendingSid = await finishRegistration(page);
  expect(await statusOf(pendingSid)).toBe('pending');
  await expect(page.getByText(BANNER)).toBeVisible();

  await page.getByRole('button', { name: 'New year' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New timetable year' });
  await dialog.getByLabel('Year label').fill('2027');
  await dialog.getByRole('button', { name: 'Create year' }).click();
  const publish = page.getByRole('button', { name: 'Publish to teachers' });
  await expect(publish).toBeDisabled();
  await expect(publish).toHaveAccessibleDescription(LOCKED);
  await shot(page, 'school-pending-dashboard');
  pendingPage = page;
});

test('super admin approves the pending school; the banner goes after reload', async ({ page }) => {
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  const row = page.getByRole('row', { name: new RegExp(`^${pendingName}`) });
  await expect(row).toContainText('Pending review');
  await row.getByRole('link', { name: 'Review' }).click();
  await expect(page).toHaveURL(new RegExp(`/super/schools/${pendingSid}$`));
  await expect(page.getByText('Not in MOE list').first()).toBeVisible();
  await shot(page, 'super-review');
  await page.getByRole('button', { name: 'Approve school' }).click();
  await expect(page.getByText(`${pendingName} approved. The school admin was emailed.`)).toBeVisible();
  await expect.poll(() => statusOf(pendingSid)).toBe('active');

  await pendingPage.reload();
  await expect(pendingPage.getByRole('navigation', { name: 'Menu' })).toContainText(pendingName);
  await expect(pendingPage.getByText(BANNER)).toBeHidden();
  await expect(pendingPage.getByRole('button', { name: 'Publish to teachers' })).toBeEnabled();
  await pendingPage.context().close();
});

test('super admin rejects a pending school; its admin sees Not approved with the reason', async ({ page, browser }) => {
  const reason = "We couldn't confirm census number 99001 with the zonal office.";
  await loginAdmin(page, SUPER.email, SUPER.password, /\/super$/);
  await page.goto(`/super/schools/${PENDING_SCHOOL.sid}`);
  await page.getByRole('button', { name: 'Reject…' }).click();
  const dialog = page.getByRole('dialog', { name: `Reject ${PENDING_SCHOOL.nameEn}?` });
  await dialog.getByRole('button', { name: 'Reject and email' }).click();
  await expect(dialog.getByText('Enter a reason. The school admin will see it.')).toBeVisible();
  await dialog.getByLabel('Reason').fill(reason);
  await dialog.getByRole('button', { name: 'Reject and email' }).click();
  await expect(page.getByText('Registration rejected. Email sent with your reason.')).toBeVisible();
  await expect.poll(() => statusOf(PENDING_SCHOOL.sid)).toBe('rejected');

  const schoolAdmin = await (await browser.newContext()).newPage();
  await loginAdmin(schoolAdmin, PENDING_ADMIN.email, PENDING_ADMIN.password);
  await expect(schoolAdmin.getByRole('heading', { name: `${PENDING_SCHOOL.nameEn} was not approved` })).toBeVisible();
  await expect(schoolAdmin.getByText(reason)).toBeVisible();
  await expect(schoolAdmin.getByRole('button', { name: 'Remove registration…' })).toBeVisible();
  await shot(schoolAdmin, 'school-not-approved');
  await schoolAdmin.context().close();
});
