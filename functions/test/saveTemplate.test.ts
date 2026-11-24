// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type TemplatePatch, type TemplateRow } from '@sathiya/core';
import { C, defaultTemplate, entry, S, T, TPL } from '@sathiya/core/fixtures';
import { describe, expect, it } from 'vitest';
import { adminDb, expectFnError, signUp, uniq } from './helpers';
import { entriesOf, putEntries, seededSchool } from './seed';

const patchOf = (rows: TemplateRow[], over: Partial<TemplatePatch> = {}): TemplatePatch => ({ name: defaultTemplate.name, mode: 'same', rows, ...over });
const call = (c: Awaited<ReturnType<typeof seededSchool>>['admin'], sid: string, patch: TemplatePatch, templateId: string = TPL.default) =>
  c.call('saveTemplate', { schoolId: sid, templateId, patch });

describe('saveTemplate', () => {
  it('moves entries when an activity row is inserted', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('e1', 0, 1, [C.c6a], [[S.maths, T.bandara]]), entry('e2', 1, 3, [C.c6b], [[S.maths, T.perera]]), entry('e1a', 0, 1, [C.c1a], [[S.english, T.wijesekara]])]);
    const first = defaultTemplate.rows[0]!;
    const rows: TemplateRow[] = [{ type: 'activity', start: '07:15', end: first.start, nameEn: 'Assembly' }, ...defaultTemplate.rows];
    await expect(call(admin, sid, patchOf(rows))).resolves.toEqual({ moved: 0 });
    const early: TemplateRow[] = [{ type: 'period', start: '07:05', end: first.start }, ...defaultTemplate.rows];
    await expect(call(admin, sid, patchOf(early))).resolves.toEqual({ moved: 2 });
    const byId = Object.fromEntries((await entriesOf(sid)).map((e) => [e.id, e.period]));
    expect(byId).toEqual({ e1: 2, e2: 4, e1a: 1 });
    const stored = (await adminDb.doc(`${paths.templates(sid)}/${TPL.default}`).get()).data();
    expect(stored?.rows).toEqual(early);
  });

  it('refuses when a used period becomes an activity', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('e1', 0, 1, [C.c6a], [[S.maths, T.bandara]])]);
    const rows: TemplateRow[] = defaultTemplate.rows.map((r, i) => (i === 0 ? { type: 'activity', start: r.start, end: r.end, nameEn: 'Assembly' } : r));
    const err = await call(admin, sid, patchOf(rows)).then(
      () => {
        throw new Error('expected refusal');
      },
      (e: { code?: string; details?: { code?: string; count?: number } }) => e,
    );
    expect(err).toMatchObject({ code: 'functions/failed-precondition', details: { code: 'template-in-use', count: 1 } });
    expect((await entriesOf(sid))[0]!.period).toBe(1);
    const stored = (await adminDb.doc(`${paths.templates(sid)}/${TPL.default}`).get()).data();
    expect(stored?.rows).toEqual(defaultTemplate.rows);
  });

  it('writes the template when no entries use it', async () => {
    const { admin, sid } = await seededSchool();
    const rows = defaultTemplate.rows.slice(0, 3);
    await expect(call(admin, sid, patchOf(rows, { name: ' Short ' }), TPL.primary)).resolves.toEqual({ moved: 0 });
    const stored = (await adminDb.doc(`${paths.templates(sid)}/${TPL.primary}`).get()).data();
    expect(stored).toMatchObject({ name: 'Short', rows });
  });

  it('rejects an invalid patch, an unknown template and non-admins', async () => {
    const { admin, sid } = await seededSchool();
    await expectFnError(call(admin, sid, patchOf([{ type: 'interval', start: '08:00', end: '08:20' }])), 'invalid-argument', 'invalid');
    await expectFnError(call(admin, sid, patchOf([{ type: 'period', start: '09:00', end: '08:00' }])), 'invalid-argument', 'invalid');
    await expectFnError(call(admin, sid, patchOf([{ type: 'activity', start: '08:00', end: '08:20' }, ...defaultTemplate.rows.slice(1)])), 'invalid-argument', 'invalid');
    await expectFnError(call(admin, sid, patchOf(defaultTemplate.rows), `nope-${uniq()}`), 'not-found', 'invalid');
    const outsider = await signUp();
    await expectFnError(call(outsider, sid, patchOf(defaultTemplate.rows)), 'permission-denied', 'not-allowed');
  });
});
