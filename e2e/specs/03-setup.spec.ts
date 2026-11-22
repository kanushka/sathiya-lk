// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test } from '@playwright/test';
import { subjects } from '@sathiya/core/fixtures';
import { freshSchoolAdmin, loginAdmin, pick, shot } from '../helpers';

test('new school setup: subjects, grade plan and period templates', async ({ page }) => {
  const admin = await freshSchoolAdmin('setup');
  await loginAdmin(page, admin.email, admin.password);

  await page.getByRole('link', { name: 'Subjects' }).click();
  await expect(page.getByText('No subjects yet')).toBeVisible();
  await page.getByRole('button', { name: 'Load standard Sri Lankan list' }).first().click();
  await expect(page.getByText(`${subjects.length} subjects added`)).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^English name of / })).toHaveCount(subjects.length);

  await page.getByRole('button', { name: '+ Add subject' }).first().click();
  const add = page.getByRole('dialog', { name: 'Add subject' });
  await add.getByLabel('Name in English').fill('Agriculture');
  await add.getByLabel('Name in Sinhala').fill('කෘෂිකර්මය');
  await expect(add.getByLabel('Short name')).toHaveValue('Agri');
  await add.getByRole('button', { name: 'Add subject' }).click();
  await expect(page.getByRole('textbox', { name: 'English name of Agriculture' })).toHaveValue('Agriculture');
  await expect(page.getByRole('textbox', { name: /^English name of / })).toHaveCount(subjects.length + 1);
  await shot(page, 'admin-subjects');

  await page.getByRole('link', { name: 'Grades & classes' }).click();
  await page.getByRole('button', { name: '+ Add grade' }).first().click();
  const grade = page.getByRole('dialog', { name: 'Add grade' });
  await pick(grade, 'Grade', 'Grade 6');
  await grade.getByRole('button', { name: 'Add grade' }).click();
  await expect(page.getByRole('heading', { name: 'Grade 6 settings' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add class 6A' }).click();
  await expect(page.getByText('6A', { exact: true })).toBeVisible();
  await pick(page, '+ Add subject', 'Mathematics');
  const maths = page.getByRole('spinbutton', { name: 'Periods per week for Mathematics' });
  await maths.fill('6');
  await maths.blur();
  await pick(page, '+ Add subject', 'Agriculture');
  await expect(page.getByRole('spinbutton', { name: 'Periods per week for Agriculture' })).toBeVisible();
  await expect(page.getByText(/\/ 40 periods in the week/)).toBeVisible();
  await shot(page, 'admin-grades');

  await page.getByRole('link', { name: 'Period templates' }).click();
  await page.getByRole('button', { name: '+ New template' }).click();
  const tpl = page.getByRole('dialog', { name: 'New template' });
  await tpl.getByLabel('Name').fill('Exam week');
  await tpl.getByRole('button', { name: 'Create template' }).click();
  await page.getByRole('button', { name: /^Exam week 8 periods/ }).click();
  await expect(page.getByRole('textbox', { name: 'Template name' })).toHaveValue('Exam week');
  await page.getByRole('button', { name: '+ Period' }).click();
  await page.getByRole('button', { name: 'Save template' }).click();
  await expect(page.getByText('Template saved')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Exam week 9 periods/ })).toBeVisible();
  await shot(page, 'admin-templates');
});
