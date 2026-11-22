// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { ADMIN } from '../../scripts/seed';
import { loginAdmin, loginTeacher } from '../helpers';

type Printed = Window & { printed?: number };

const PASSWORD = /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/;
const TEACHER_HEADER = 'Staff ID,Title,Full name,Phone,Email,Subjects,Grades,Max periods/day,Primary teacher?';
const csv = (name: string, ...lines: string[]) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(`${lines.join('\n')}\n`) });

test('admin bulk-imports teachers and subjects from a template', async ({ page, browser }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.getByRole('link', { name: 'Teachers' }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  const modal = page.getByRole('dialog', { name: 'Import subjects and teachers' });
  const [download] = await Promise.all([page.waitForEvent('download'), modal.getByRole('button', { name: 'Download Excel template' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

  const chooser = modal.locator('input[type=file]');
  await chooser.setInputFiles(csv('bad.csv', TEACHER_HEADER, ',Mr.,Import Bad,,,Basket Weaving,6-8,,'));
  await expect(modal.getByText(/Fix 1 problem/)).toBeVisible();
  await expect(modal.getByRole('cell', { name: 'Unknown subject: Basket Weaving' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();

  await chooser.setInputFiles(
    csv('teachers.csv', TEACHER_HEADER, 'SCC080,Mr.,Import One,,,Mathematics,6-8,,', ',Mrs.,Import Two,,,Mathematics,6-8,,'),
  );
  await expect(modal.getByText('2 teachers')).toBeVisible();
  await modal.getByRole('button', { name: 'Import', exact: true }).click();
  const done = page.getByRole('dialog', { name: 'Import complete' });
  await expect(done.getByText('Added 0 subjects and 2 teachers.')).toBeVisible();

  await page.evaluate(() => {
    const win = window as Printed;
    const open = window.open.bind(window);
    window.open = (...args: Parameters<typeof window.open>) => {
      const w = open(...args);
      if (w) w.print = () => void (win.printed = (win.printed ?? 0) + 1);
      return w;
    };
  });
  const [popup] = await Promise.all([page.waitForEvent('popup'), done.getByRole('button', { name: 'Print login slips' }).click()]);
  const cards = popup.locator('article');
  await expect(cards).toHaveCount(2);
  const passwords = (await cards.locator('.pw').allTextContents()).map((p) => p.trim());
  for (const p of passwords) expect(p).toMatch(PASSWORD);
  const slipText = await cards.allTextContents();
  const oneIdx = slipText.findIndex((t) => t.includes('SCC080'));
  expect(oneIdx).toBeGreaterThanOrEqual(0);
  await expect.poll(() => page.evaluate(() => (window as Printed).printed)).toBe(1);
  await popup.close();

  await done.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('row', { name: /SCC080 Mr\. Import One/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Mrs\. Import Two/ })).toBeVisible();

  const teacher = await (await browser.newContext()).newPage();
  await loginTeacher(teacher, 'SCC080', passwords[oneIdx]!);
  await expect(teacher).toHaveURL(/\/me/);

  await page.getByRole('link', { name: 'Subjects' }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  const subjectModal = page.getByRole('dialog', { name: 'Import subjects and teachers' });
  await subjectModal.locator('input[type=file]').setInputFiles(csv('subjects.csv', 'Name (English),Name (Sinhala),Short name', 'Pottery,,Pot'));
  await expect(subjectModal.getByText('1 subject', { exact: false })).toBeVisible();
  await subjectModal.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('dialog', { name: 'Import complete' }).getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('textbox', { name: /^English name of Pottery/ })).toHaveValue('Pottery');
});
