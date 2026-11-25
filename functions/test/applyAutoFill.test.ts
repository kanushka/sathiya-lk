// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type EntryDraft } from '@sathiya/core';
import { C, defaultTemplate, entry, G, S, T, TPL } from '@sathiya/core/fixtures';
import { FieldValue } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { writeInChunks, PartialWrite } from '../src/lib/applyWrites';
import { releaseLease } from '../src/lib/yearBusy';
import { adminDb, adminWithSchool, expectFnError, signUp } from './helpers';
import { draft, entriesOf, putEntries, seededSchool, YEAR } from './seed';

type Seeded = Awaited<ReturnType<typeof seededSchool>>;
const apply = (c: Seeded['admin'], sid: string, drafts: EntryDraft[], deleteEntryIds: string[] = [], yearId = YEAR) =>
  c.call('applyAutoFill', { schoolId: sid, yearId, deleteEntryIds, drafts });
const yearRef = (sid: string) => adminDb.doc(`${paths.years(sid)}/${YEAR}`);
const setBusy = (sid: string, ms = Date.now() + 60_000) => yearRef(sid).update({ applyingUntil: ms });
const flagOf = async (sid: string) => (await yearRef(sid).get()).get('applyingUntil');

describe('applyAutoFill', () => {
  it('writes drafts and deletes', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('old1', 0, 1, [C.c6a], [[S.maths, T.bandara]]), entry('keep', 1, 1, [C.c6b], [[S.maths, T.perera]])]);
    const res = await apply(
      admin,
      sid,
      [
        draft(0, 1, [C.c6a], [[S.science, T.gunasekara]], { id: 'client-id' }),
        draft(0, 2, [C.c6a, C.c6b], [[S.maths, T.bandara], [S.english, T.perera]], { groupKey: 'g' }),
      ],
      ['old1'],
    );
    expect(res).toEqual({ written: 2, deleted: 1 });
    const all = await entriesOf(sid);
    expect(all).toHaveLength(3);
    expect(all.find((e) => e.id === 'old1')).toBeUndefined();
    expect(all.find((e) => e.id === 'client-id')).toBeUndefined();
    expect(all.find((e) => e.period === 1 && e.day === 0)).toMatchObject({ classIds: [C.c6a], teacherIds: [T.gunasekara] });
    expect(all.find((e) => e.groupKey === 'g')?.teacherIds.sort()).toEqual([T.bandara, T.perera].sort());
    expect(await flagOf(sid)).toBeUndefined();
  });

  it('rejects when a draft clashes with a newer entry', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('newer', 0, 1, [C.c6b], [[S.maths, T.perera]])]);
    const err = await apply(admin, sid, [draft(0, 3, [C.c6a], [[S.maths, T.bandara]]), draft(0, 1, [C.c6a], [[S.science, T.perera]])]).then(
      () => {
        throw new Error('expected clash');
      },
      (e: { code?: string; details?: { code?: string; conflicts?: unknown[] } }) => e,
    );
    expect(err).toMatchObject({
      code: 'functions/failed-precondition',
      details: { code: 'clash', conflicts: [{ draftIndex: 1, kind: 'teacher', id: T.perera, entryId: 'newer' }] },
    });
    expect((await entriesOf(sid)).map((e) => e.id)).toEqual(['newer']);
    expect(await flagOf(sid)).toBeUndefined();
  });

  it('rejects clashes between drafts and honours deleteEntryIds', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('old', 0, 1, [C.c6a], [[S.maths, T.bandara]])]);
    await expect(apply(admin, sid, [draft(0, 1, [C.c6a], [[S.science, T.gunasekara]])], ['old'])).resolves.toEqual({ written: 1, deleted: 1 });
    const err = await apply(admin, sid, [draft(1, 1, [C.c6a], [[S.maths, T.bandara]]), draft(1, 1, [C.c6b], [[S.maths, T.bandara]])]).then(
      () => {
        throw new Error('expected clash');
      },
      (e: { details?: { conflicts?: Array<{ draftIndex: number }> } }) => e,
    );
    expect(err.details?.conflicts?.map((c) => c.draftIndex)).toEqual([0]);
    expect(await entriesOf(sid)).toHaveLength(1);
  });

  it('rejects an unknown deleteEntryId and writes nothing', async () => {
    const { admin, sid } = await seededSchool();
    await expectFnError(apply(admin, sid, [draft(0, 1, [C.c6a], [[S.maths, T.bandara]])], ['nope']), 'invalid-argument', 'invalid');
    expect(await entriesOf(sid)).toHaveLength(0);
    expect(await flagOf(sid)).toBeUndefined();
  });

  it('validates drafts and limits', async () => {
    const { admin, sid } = await seededSchool();
    await expectFnError(apply(admin, sid, [draft(0, 1, [C.c6a], [['nope', T.bandara]])]), 'invalid-argument', 'invalid');
    await expectFnError(apply(admin, sid, [draft(0, 99, [C.c6a], [[S.maths, T.bandara]])]), 'invalid-argument', 'invalid');
    const many = Array.from({ length: 3001 }, () => draft(0, 1, [C.c6a], [[S.maths, T.bandara]]));
    await expectFnError(apply(admin, sid, many), 'invalid-argument', 'invalid');
    await expectFnError(apply(admin, sid, [], Array.from({ length: 3001 }, (_, i) => `d${i}`)), 'invalid-argument', 'invalid');
    expect(await flagOf(sid)).toBeUndefined();
  });

  it('rejects non-admin', async () => {
    const { sid } = await seededSchool();
    const outsider = await signUp();
    await expectFnError(apply(outsider, sid, []), 'permission-denied', 'not-allowed');
    const { admin: other } = await adminWithSchool();
    await expectFnError(apply(other, sid, []), 'permission-denied', 'not-allowed');
  });

  it('refuses busy while another apply is in progress, ignoring an expired flag', async () => {
    const { admin, sid } = await seededSchool();
    await setBusy(sid);
    await expectFnError(apply(admin, sid, []), 'failed-precondition', 'busy');
    expect(await flagOf(sid)).toBeGreaterThan(Date.now());
    await setBusy(sid, Date.now() - 1000);
    await expect(apply(admin, sid, [draft(0, 1, [C.c6a], [[S.maths, T.bandara]])])).resolves.toEqual({ written: 1, deleted: 0 });
    expect(await flagOf(sid)).toBeUndefined();
  });

  it('saveEntry, deleteEntry and saveTemplate fail busy while applying', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('e1', 0, 1, [C.c6a], [[S.maths, T.bandara]])]);
    await setBusy(sid);
    await expectFnError(admin.call('saveEntry', { schoolId: sid, yearId: YEAR, entry: draft(1, 1, [C.c6b], [[S.maths, T.perera]]) }), 'failed-precondition', 'busy');
    await expectFnError(admin.call('deleteEntry', { schoolId: sid, yearId: YEAR, entryId: 'e1' }), 'failed-precondition', 'busy');
    const early = [{ type: 'period' as const, start: '07:05', end: defaultTemplate.rows[0]!.start }, ...defaultTemplate.rows];
    await expectFnError(
      admin.call('saveTemplate', { schoolId: sid, templateId: TPL.default, patch: { name: defaultTemplate.name, mode: 'same', rows: early } }),
      'failed-precondition',
      'busy',
    );
    expect(await entriesOf(sid)).toHaveLength(1);
    await yearRef(sid).update({ applyingUntil: FieldValue.delete() });
    await expect(admin.call('deleteEntry', { schoolId: sid, yearId: YEAR, entryId: 'e1' })).resolves.toEqual({ ok: true });
  });

  it('writes more than one batch of operations', async () => {
    const { admin, sid } = await seededSchool();
    const cls = (await adminDb.doc(`${paths.classes(sid)}/${C.c6a}`).get()).data()!;
    const ids = Array.from({ length: 15 }, (_, i) => `x${i}`);
    await Promise.all(ids.map((id) => adminDb.doc(`${paths.classes(sid)}/${id}`).set({ ...cls, name: id, gradeId: G.g6 })));
    const drafts = Array.from({ length: 460 }, (_, i) => draft(Math.floor((i % 32) / 8), 1 + (i % 8), [ids[Math.floor(i / 32)]!], [[S.maths, null]]));
    await expect(apply(admin, sid, drafts)).resolves.toEqual({ written: 460, deleted: 0 });
    expect(await entriesOf(sid)).toHaveLength(460);
    expect(await flagOf(sid)).toBeUndefined();
  });

  it('does not release another apply\'s newer lease', async () => {
    const { sid } = await seededSchool();
    const ref = adminDb.doc(`${paths.years(sid)}/${YEAR}`) as never;
    const mine = Date.now() + 1000;
    const newer = Date.now() + 500_000;
    await setBusy(sid, newer);
    await releaseLease(ref, mine);
    expect(await flagOf(sid)).toBe(newer);
    await releaseLease(ref, newer);
    expect(await flagOf(sid)).toBeUndefined();
  });

  it('refuses publishYear busy while applying', async () => {
    const { admin, sid } = await seededSchool();
    await setBusy(sid);
    await expectFnError(admin.call('publishYear', { schoolId: sid, yearId: YEAR }), 'failed-precondition', 'busy');
    expect((await yearRef(sid).get()).get('status')).toBe('draft');
  });

  it('dedupes deleteEntryIds and reports a draft-vs-draft clash once', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('old', 0, 1, [C.c6a], [[S.maths, T.bandara]])]);
    await expect(apply(admin, sid, [], ['old', 'old'])).resolves.toEqual({ written: 0, deleted: 1 });
    const err = await apply(admin, sid, [draft(1, 1, [C.c6a], [[S.maths, T.bandara]]), draft(1, 1, [C.c6b], [[S.maths, T.bandara]])]).then(
      () => {
        throw new Error('expected clash');
      },
      (e: { details?: { conflicts?: unknown[] } }) => e,
    );
    expect(err.details?.conflicts).toEqual([{ draftIndex: 0, kind: 'teacher', id: T.bandara, entryId: 'draft-1' }]);
  });

  it('reports what was written when a chunk fails', async () => {
    const refs = (n: number) => Array.from({ length: n }, (_, i) => adminDb.doc(`scratch/pw-${i}`));
    let commits = 0;
    const newBatch = () => {
      const b = adminDb.batch();
      const commit = b.commit.bind(b);
      b.commit = async () => {
        if (++commits === 2) throw new Error('boom');
        return commit();
      };
      return b;
    };
    const err = await writeInChunks([], refs(460).map((ref) => ({ ref, data: { x: 1 } })), newBatch).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PartialWrite);
    expect(err).toMatchObject({ written: 450, deleted: 0 });
    await adminDb.recursiveDelete(adminDb.collection('scratch'));
  });

  it('times a 3000-draft apply', async () => {
    const { admin, sid } = await seededSchool();
    const cls = (await adminDb.doc(`${paths.classes(sid)}/${C.c6a}`).get()).data()!;
    const ids = Array.from({ length: 94 }, (_, i) => `y${i}`);
    for (let i = 0; i < ids.length; i += 400) await Promise.all(ids.slice(i, i + 400).map((id) => adminDb.doc(`${paths.classes(sid)}/${id}`).set({ ...cls, name: id, gradeId: G.g6 })));
    const drafts = Array.from({ length: 3000 }, (_, i) => draft(Math.floor((i % 32) / 8), 1 + (i % 8), [ids[Math.floor(i / 32)]!], [[S.maths, null]]));
    const t0 = Date.now();
    await expect(apply(admin, sid, drafts)).resolves.toEqual({ written: 3000, deleted: 0 });
    console.log(`apply 3000 drafts: ${Date.now() - t0} ms`);
  }, 120_000);
});
