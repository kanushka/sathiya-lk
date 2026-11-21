// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, type Page } from '@playwright/test';
import { school } from '@sathiya/core/fixtures';
import { HOST, PORTS, PROJECT_ID } from '../scripts/seed';

export const SHOTS = new URL('./__screenshots__/', import.meta.url).pathname;

export const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });

export const adminForm = (page: Page) => page.locator('form', { has: page.getByRole('heading', { name: 'Admin login' }) });
export const teacherForm = (page: Page) => page.locator('form', { has: page.getByRole('heading', { name: 'Teacher login' }) });

export async function loginAdmin(page: Page, email: string, password: string, landing: RegExp = /\/admin$/): Promise<void> {
  await page.goto('/login');
  const form = adminForm(page);
  await form.getByLabel('Email').fill(email);
  await form.getByLabel('Password').fill(password);
  await form.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(landing);
}

export async function loginTeacher(page: Page, staffId: string, password: string, schoolName = school.nameEn): Promise<void> {
  await page.goto('/login?as=teacher');
  const form = teacherForm(page);
  await form.getByRole('combobox').fill(schoolName.slice(0, 8));
  await page.getByRole('option', { name: new RegExp(schoolName) }).click();
  await form.getByLabel('Staff ID').fill(staffId);
  await form.getByLabel('Password').fill(password);
  await form.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/me$/);
}

const authBase = `http://${HOST}:${PORTS.auth}`;

export async function oobCodes(): Promise<Array<{ email: string; oobCode: string; requestType: string; oobLink: string }>> {
  const res = await fetch(`${authBase}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  return ((await res.json()) as { oobCodes: never[] }).oobCodes;
}

export const oobCodeOf = (link: string): string => {
  const code = new URL(link).searchParams.get('oobCode');
  if (!code) throw new Error(`no oobCode in ${link}`);
  return code;
};

export async function idToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = (await res.json()) as { idToken?: string };
  if (!body.idToken) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(body)}`);
  return body.idToken;
}

export async function callAs<T>(token: string, name: string, data: unknown): Promise<T> {
  const res = await fetch(`http://${HOST}:${PORTS.functions}/${PROJECT_ID}/us-central1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const body = (await res.json()) as { result?: T; error?: unknown };
  if (!res.ok || body.error) throw new Error(`${name} failed: ${JSON.stringify(body)}`);
  return body.result as T;
}
