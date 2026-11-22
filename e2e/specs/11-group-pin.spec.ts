// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, test, type Page } from '@playwright/test';
import { paths } from '@sathiya/core';
import { C, G, grades, S, T } from '@sathiya/core/fixtures';
import { FieldValue } from 'firebase-admin/firestore';
import { ADMIN, admin, SID, YEAR_ID } from '../../scripts/seed';
import { callAs, idToken, loginAdmin, shot } from '../helpers';

const classDoc = () => admin().db.doc(`${paths.classes(SID)}/${C.c6c}`);

test.beforeAll(async () => {
  const plan = grades.find((g) => g.id === G.g6)!.plan.map((p) => (p.kind === 'group' && p.key === 'religion' ? { ...p, optionSubjectIds: [S.buddhism, S.catholicism] } : p));
  await classDoc().update({ planOverride: plan });
  const { db } = admin();
  const held = await db.collection(paths.entries(SID, YEAR_ID)).where('classIds', 'array-contains', C.c6c).get();
  await Promise.all(held.docs.filter((d) => d.get('groupKey') === 'religion').map((d) => d.ref.delete()));
  await callAs(await idToken(ADMIN.email, ADMIN.password), 'saveEntry', {
    schoolId: SID,
    yearId: YEAR_ID,
    entry: { day: 2, period: 5, classIds: [C.c12a], lessons: [{ subjectId: S.pali, teacherId: T.ananda }] },
  });
});

test.afterAll(async () => {
  await classDoc().update({ planOverride: FieldValue.delete() });
});

const pinCell = (page: Page, day: string, n: number) => page.getByRole('button', { name: new RegExp(`^${day}, period ${n}, [0-9:–]+: pin Religion for 6C$`) });
const pinnedCell = (page: Page, day: string, n: number) => page.getByRole('button', { name: new RegExp(`^${day}, period ${n}, [0-9:–]+: Religion 6C, pinned, click to unpin$`) });

async function chooseTeacher(page: Page, subject: string, name: RegExp) {
  const group = page.getByRole('dialog', { name: 'Set teachers for Religion' });
  await group.getByRole('button', { name: new RegExp(`^${subject} teacher:`) }).click();
  await group.getByRole('listbox', { name: `${subject} teachers` }).getByRole('option', { name }).click();
}

test('class view: pin a two-option religion group past a busy teacher', async ({ page }) => {
  await loginAdmin(page, ADMIN.email, ADMIN.password);
  await page.goto(`/admin/timetable/class/${C.c6c}`);

  const plus = page.getByRole('button', { name: 'Wednesday, period 5, 10:50–11:30: empty, Add lesson' });
  await plus.click();
  await plus.press('Enter');
  await page.getByRole('dialog', { name: 'Choose a subject' }).getByRole('option', { name: /^Religion/ }).click();

  const group = page.getByRole('dialog', { name: 'Set teachers for Religion' });
  await expect(group.getByRole('button', { name: /teacher:/ })).toHaveCount(2);
  await chooseTeacher(page, 'Buddhism', /^Ven\. Ananda Thero/);
  await chooseTeacher(page, 'Catholicism', /M\. Silva/);
  await expect(group.getByText('Ven. Ananda Thero · Teaching 12A · Pali on Wed P5. Pin the other free slots instead.')).toBeVisible();
  await group.getByRole('button', { name: 'Pin other slots' }).click();
  await expect(group).toBeHidden();

  const bar = page.getByRole('region', { name: 'Pin mode' });
  await expect(bar).toContainText('Religion · 6C');
  await expect(bar).toContainText('Buddhism – Ven. Ananda Thero');
  await expect(bar).toContainText('0 of 3 placed · 3 to go');
  const blocked = page.getByRole('button', { name: 'Wednesday, period 5, 10:50–11:30: busy, Ven. Ananda Thero · Teaching 12A · Pali' });
  await expect(blocked).toHaveAttribute('aria-disabled', 'true');

  await pinCell(page, 'Monday', 1).click();
  await expect(pinnedCell(page, 'Monday', 1)).toBeVisible();
  await pinCell(page, 'Tuesday', 1).click();
  await expect(pinnedCell(page, 'Tuesday', 1)).toBeVisible();
  await pinCell(page, 'Thursday', 1).click();
  await expect(pinnedCell(page, 'Thursday', 1)).toBeVisible();
  await expect(page.getByText('Religion pinned to Thursday, period 1.')).toBeVisible();
  await expect(bar).toContainText('3 of 3 placed · complete');
  await shot(page, 'group-pin-mode');

  await page.keyboard.press('Escape');
  await expect(bar).toBeHidden();
  for (const day of ['Monday', 'Tuesday', 'Thursday']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${day}, period 1, 07:45–08:30: Religion`) })).toBeVisible();
  }
});
