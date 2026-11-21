// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, syntheticEmail } from '@sathiya/core';
import { C, entry, S, T } from '@sathiya/core/fixtures';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { describe, expect, it } from 'vitest';
import { saveEntry as saveEntryFn } from '../src/saveEntry';
import { adminDb, adminWithSchool, expectFnError, makeSuper, signIn, signUp, teacherInput } from './helpers';
import { draft, entriesOf, putEntries, seededSchool, YEAR } from './seed';

const save = (c: { call: (n: 'saveEntry', r: never) => Promise<unknown> }, sid: string, entry: ReturnType<typeof draft>, yearId = YEAR) =>
  c.call('saveEntry', { schoolId: sid, yearId, entry } as never) as Promise<{ entryId: string }>;

async function clashOf(p: Promise<unknown>): Promise<{ code?: string; details?: { code?: string; conflicts?: unknown[] } }> {
  return p.then(
    () => {
      throw new Error('expected a clash, call succeeded');
    },
    (e: { code?: string; details?: { code?: string; conflicts?: unknown[] } }) => e,
  );
}

describe('saveEntry', () => {
  it('stores a new entry with derived teacherIds', async () => {
    const { admin, sid } = await seededSchool();
    const { entryId } = await save(admin, sid, draft(0, 2, [C.c6a], [[S.maths, T.bandara]]));
    const stored = (await adminDb.doc(`${paths.entries(sid, YEAR)}/${entryId}`).get()).data();
    expect(stored).toMatchObject({ day: 0, period: 2, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.bandara }], teacherIds: [T.bandara] });
  });

  it('rejects a teacher clash with the conflict list', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('e-6b', 1, 3, [C.c6b], [[S.maths, T.perera]])]);
    const err = await clashOf(save(admin, sid, draft(1, 3, [C.c6a], [[S.maths, T.perera]])));
    expect(err.code).toBe('functions/failed-precondition');
    expect(err.details).toEqual({ code: 'clash', conflicts: [{ kind: 'teacher', id: T.perera, entryId: 'e-6b' }] });
    expect((await entriesOf(sid)).length).toBe(1);
  });

  it('rejects a class clash', async () => {
    const { admin, sid } = await seededSchool();
    await putEntries(sid, [entry('e-6a', 2, 1, [C.c6a], [[S.maths, T.bandara]])]);
    const err = await clashOf(save(admin, sid, draft(2, 1, [C.c6a], [[S.science, T.gunasekara]])));
    expect(err.details).toEqual({ code: 'clash', conflicts: [{ kind: 'class', id: C.c6a, entryId: 'e-6a' }] });
  });

  it('detects a cross-template clock-time clash', async () => {
    const { admin, sid } = await seededSchool();
    // 6A default P3 09:10–09:50 overlaps 1A Primary P3 09:00–09:40.
    await putEntries(sid, [entry('e-1a', 0, 3, [C.c1a], [[S.english, T.wijesekara]])]);
    const err = await clashOf(save(admin, sid, draft(0, 3, [C.c6a], [[S.english, T.wijesekara]])));
    expect(err.details).toEqual({ code: 'clash', conflicts: [{ kind: 'teacher', id: T.wijesekara, entryId: 'e-1a' }] });
    // No overlap: 6A P1 07:45–08:30 vs 1A P3.
    await expect(save(admin, sid, draft(0, 1, [C.c6a], [[S.english, T.wijesekara]]))).resolves.toEqual({ entryId: expect.any(String) });
  });

  it('edits an entry in place without clashing with itself', async () => {
    const { admin, sid } = await seededSchool();
    const { entryId } = await save(admin, sid, draft(3, 4, [C.c6a], [[S.maths, T.bandara]]));
    const res = await save(admin, sid, draft(3, 4, [C.c6a], [[S.maths, T.jayawardena]], { id: entryId }));
    expect(res).toEqual({ entryId });
    const all = await entriesOf(sid);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: entryId, teacherIds: [T.jayawardena] });
  });

  it('refuses to edit an unknown entry', async () => {
    const { admin, sid } = await seededSchool();
    await expectFnError(save(admin, sid, draft(0, 1, [C.c6a], [[S.maths, T.bandara]], { id: 'missing' })), 'not-found', 'invalid');
  });

  it('serialises concurrent saves: one teacher in 6A and 6B in the same slot', async () => {
    const { admin, sid } = await seededSchool();
    for (let i = 0; i < 5; i++) {
      const day = i % 5;
      const period = 1 + i;
      const results = await Promise.allSettled([
        save(admin, sid, draft(day, period, [C.c6a], [[S.maths, T.perera]])),
        save(admin, sid, draft(day, period, [C.c6b], [[S.maths, T.perera]])),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect({ code: rejected.reason.code, api: rejected.reason.details?.code }).toEqual({ code: 'functions/failed-precondition', api: 'clash' });
    }
    expect(await entriesOf(sid)).toHaveLength(5);
  });

  it('serialises concurrent saves in-process (no emulator worker queueing)', async () => {
    const { admin, sid } = await seededSchool();
    const claims = await admin.claims();
    const req = (entry: ReturnType<typeof draft>) =>
      ({ data: { schoolId: sid, yearId: YEAR, entry }, auth: { uid: admin.uid, token: { ...claims, uid: admin.uid } }, rawRequest: {} }) as unknown as CallableRequest;
    for (let i = 0; i < 5; i++) {
      const results = await Promise.allSettled([
        saveEntryFn.run(req(draft(i, 6, [C.c6a], [[S.science, T.gunasekara]]))),
        saveEntryFn.run(req(draft(i, 6, [C.c6b], [[S.science, T.gunasekara]]))),
        saveEntryFn.run(req(draft(i, 6, [C.c12a], [[S.science, T.gunasekara]]))),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const r of results) if (r.status === 'rejected') expect(r.reason.details?.code).toBe('clash');
    }
    expect(await entriesOf(sid)).toHaveLength(5);
  });

  it('rejects an invalid day or period', async () => {
    const { admin, sid } = await seededSchool();
    for (const [day, period] of [[5, 1], [-1, 1], [0, 0], [0, 9], [0, 1.5]]) {
      await expectFnError(save(admin, sid, draft(day!, period!, [C.c6a], [[S.maths, T.bandara]])), 'invalid-argument', 'invalid');
    }
    // Primary has 6 periods; Short Friday has 7 on Friday.
    await expectFnError(save(admin, sid, draft(0, 7, [C.c1a], [[S.maths, T.wickramasinghe]])), 'invalid-argument', 'invalid');
    await expectFnError(save(admin, sid, draft(4, 8, [C.c6c], [[S.maths, T.bandara]])), 'invalid-argument', 'invalid');
    await expect(save(admin, sid, draft(3, 8, [C.c6c], [[S.maths, T.bandara]]))).resolves.toBeTruthy();
  });

  it('rejects a bad shape and unknown references', async () => {
    const { admin, sid } = await seededSchool();
    const bad = [
      draft(0, 1, [], [[S.maths, T.bandara]]),
      draft(0, 1, [C.c6a], []),
      draft(0, 1, ['c-nope'], [[S.maths, T.bandara]]),
      draft(0, 1, [C.c6a], [['s-nope', T.bandara]]),
      draft(0, 1, [C.c6a], [[S.maths, 't-nope']]),
    ];
    for (const e of bad) await expectFnError(save(admin, sid, e), 'invalid-argument', 'invalid');
    await expectFnError(save(admin, sid, draft(0, 1, [C.c6a], [[S.maths, T.bandara]]), 'no-such-year'), 'invalid-argument', 'invalid');
    await expect(save(admin, sid, draft(0, 1, [C.c6a], [[S.maths, null]]))).resolves.toBeTruthy();
  });

  it('rejects mixed-template and mixed-grade blocks', async () => {
    const { admin, sid } = await seededSchool();
    const religion = (classIds: string[]) =>
      draft(1, 2, classIds, [[S.buddhism, T.ananda], [S.catholicism, T.mSilva], [S.islam, T.rizan]], { groupKey: 'religion' });
    // 6C uses Short Friday, 6A the default template.
    await expectFnError(save(admin, sid, religion([C.c6a, C.c6c])), 'invalid-argument', 'invalid');
    // 12A is grade 12.
    await expectFnError(save(admin, sid, religion([C.c6a, C.c12a])), 'invalid-argument', 'invalid');
    const { entryId } = await save(admin, sid, religion([C.c6a, C.c6b]));
    const stored = (await adminDb.doc(`${paths.entries(sid, YEAR)}/${entryId}`).get()).data();
    expect(stored).toMatchObject({ classIds: [C.c6a, C.c6b], groupKey: 'religion', teacherIds: [T.ananda, T.mSilva, T.rizan] });
  });

  it('refuses non-admins, super admins, other schools and disabled schools', async () => {
    const { admin, sid } = await seededSchool();
    const e = draft(0, 1, [C.c6a], [[S.maths, T.bandara]]);
    const { admin: other } = await adminWithSchool();
    await expectFnError(save(other, sid, e), 'permission-denied', 'not-allowed');
    const { password } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC101') });
    const teacher = await signIn(syntheticEmail('SCC101', sid), password);
    await expectFnError(save(teacher, sid, e), 'permission-denied', 'not-allowed');
    const sup = await signUp();
    await makeSuper(sup);
    await expectFnError(save(sup, sid, e), 'permission-denied', 'not-allowed');
    await sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' });
    await expectFnError(save(admin, sid, e), 'permission-denied', 'not-allowed');
  });
});

describe('deleteEntry', () => {
  it('deletes an entry', async () => {
    const { admin, sid } = await seededSchool();
    const { entryId } = await save(admin, sid, draft(0, 1, [C.c6a], [[S.maths, T.bandara]]));
    await expect(admin.call('deleteEntry', { schoolId: sid, yearId: YEAR, entryId })).resolves.toEqual({ ok: true });
    expect(await entriesOf(sid)).toHaveLength(0);
  });

  it('refuses an unknown entry and a non-admin', async () => {
    const { admin, sid } = await seededSchool();
    await expectFnError(admin.call('deleteEntry', { schoolId: sid, yearId: YEAR, entryId: 'nope' }), 'not-found', 'invalid');
    const { entryId } = await save(admin, sid, draft(0, 1, [C.c6a], [[S.maths, T.bandara]]));
    const { admin: other } = await adminWithSchool();
    await expectFnError(other.call('deleteEntry', { schoolId: sid, yearId: YEAR, entryId }), 'permission-denied', 'not-allowed');
    expect(await entriesOf(sid)).toHaveLength(1);
  });
});
