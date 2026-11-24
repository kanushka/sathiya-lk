// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { colomboToday, paths, type ReliefDay, type SaveReliefDayReq } from '@sathiya/core';
import { C, entry, S, T } from '@sathiya/core/fixtures';
import { describe, expect, it } from 'vitest';
import { adminDb, expectFnError, signUp, type Client } from './helpers';
import { publishedSeed, seededSchool, YEAR } from './seed';

const today = colomboToday(new Date());
const day = today.day;
const d = day ?? 0;
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const entries = () => [
  entry('e-a', d, 1, [C.c6a], [[S.maths, T.bandara]]),
  entry('e-b', d, 2, [C.c6a], [[S.science, T.bandara]]),
  entry('e-busy', d, 1, [C.c6b], [[S.science, T.gunasekara]]),
];
const leaves = [{ teacherId: T.bandara, type: 'full' as const, entryIds: ['e-a', 'e-b'] }];
const pick = (entryId: string, reliefTeacherId: string | null) => ({ entryId, absentTeacherId: T.bandara, reliefTeacherId }) as unknown as SaveReliefDayReq['reliefs'][number];

const req = (sid: string, over: Partial<SaveReliefDayReq> = {}): SaveReliefDayReq => ({
  schoolId: sid, yearId: YEAR, date: today.date, leaves, reliefs: [pick('e-a', T.kumara), pick('e-b', null)], expectedUpdatedAt: null, ...over,
});
const stats = async (sid: string) => ((await adminDb.doc(paths.reliefStats(sid, YEAR)).get()).data() as { counts: Record<string, number> } | undefined)?.counts ?? {};

describe('saveReliefDay', () => {
  it.skipIf(day === null)('saves today and returns counts', async () => {
    const { admin, sid } = await publishedSeed(entries());
    const res = await admin.call('saveReliefDay', req(sid));
    expect(res).toMatchObject({ updatedAt: expect.any(Number), uncovered: 1 });
    expect(res.queued + res.skippedNoEmail).toBe(1);
    const doc = (await adminDb.doc(paths.reliefDay(sid, YEAR, today.date)).get()).data() as ReliefDay;
    expect(doc).toMatchObject({ date: today.date, day: d, updatedAt: res.updatedAt, updatedBy: admin.uid });
    expect(doc.reliefs.map((r) => [r.entryId, r.reliefTeacherId, r.start])).toEqual([['e-a', T.kumara, '07:45'], ['e-b', null, '08:30']]);
    expect(Object.keys(doc.names).sort()).toEqual([T.bandara, T.kumara].sort());
    expect(await stats(sid)).toEqual({ [T.kumara]: 1 });
  });

  it('refuses another date', async () => {
    const { admin, sid } = await publishedSeed();
    await expectFnError(admin.call('saveReliefDay', req(sid, { date: yesterday })), 'invalid-argument', 'invalid');
  });

  it('refuses non-admin', async () => {
    const { sid } = await publishedSeed();
    const other: Client = await signUp();
    await expectFnError(other.call('saveReliefDay', req(sid)), 'permission-denied', 'not-allowed');
  });

  it('refuses unpublished year', async () => {
    const { admin, sid } = await seededSchool();
    await expectFnError(admin.call('saveReliefDay', req(sid)), 'invalid-argument', 'invalid');
  });

  it('refuses duplicate leave teachers and unknown leave types', async () => {
    const { admin, sid } = await publishedSeed();
    await expectFnError(admin.call('saveReliefDay', req(sid, { leaves: [...leaves, ...leaves] })), 'invalid-argument', 'invalid');
    await expectFnError(admin.call('saveReliefDay', req(sid, { leaves: [{ ...leaves[0]!, type: 'nap' as never }] })), 'invalid-argument', 'invalid');
  });

  it.skipIf(day === null)('asks to republish when a snapshot cell has no entryId', async () => {
    const { admin, sid } = await publishedSeed(entries());
    const ref = adminDb.doc(paths.publishedTeacher(sid, YEAR, T.bandara));
    const snap = (await ref.get()).data() as { cells: Array<Record<string, unknown>> };
    await ref.update({ cells: snap.cells.map(({ entryId: _e, ...c }) => c) });
    await expectFnError(admin.call('saveReliefDay', req(sid)), 'failed-precondition', 'republish');
  });

  it.skipIf(day === null)('refuses stale expectedUpdatedAt with code stale', async () => {
    const { admin, sid } = await publishedSeed(entries());
    const first = await admin.call('saveReliefDay', req(sid));
    await expectFnError(admin.call('saveReliefDay', req(sid, { expectedUpdatedAt: null })), 'failed-precondition', 'stale');
    await expectFnError(admin.call('saveReliefDay', req(sid, { expectedUpdatedAt: first.updatedAt - 1 })), 'failed-precondition', 'stale');
    await expect(admin.call('saveReliefDay', req(sid, { expectedUpdatedAt: first.updatedAt }))).resolves.toMatchObject({ updatedAt: expect.any(Number) });
  });

  it.skipIf(day === null)('refuses relief by busy teacher with invalid-relief', async () => {
    const { admin, sid } = await publishedSeed(entries());
    const err = await admin.call('saveReliefDay', req(sid, { reliefs: [pick('e-a', T.gunasekara), pick('e-b', null)] })).then(
      () => { throw new Error('expected failure'); },
      (e: { code?: string; details?: { code?: string; errors?: unknown[] } }) => e,
    );
    expect(err.code).toBe('functions/failed-precondition');
    expect(err.details).toEqual({ code: 'invalid-relief', errors: [{ code: 'busy', entryId: 'e-a', teacherId: T.gunasekara }] });
  });

  it.skipIf(day === null)('stats track add, swap and remove', async () => {
    const { admin, sid } = await publishedSeed(entries());
    const r1 = await admin.call('saveReliefDay', req(sid, { reliefs: [pick('e-a', T.kumara), pick('e-b', T.kumara)] }));
    expect(await stats(sid)).toEqual({ [T.kumara]: 2 });
    const r2 = await admin.call('saveReliefDay', req(sid, { reliefs: [pick('e-a', T.herath), pick('e-b', T.kumara)], expectedUpdatedAt: r1.updatedAt }));
    expect(await stats(sid)).toEqual({ [T.kumara]: 1, [T.herath]: 1 });
    await admin.call('saveReliefDay', req(sid, { reliefs: [], expectedUpdatedAt: r2.updatedAt }));
    expect(await stats(sid)).toEqual({});
  });

  it.skipIf(day === null)('a late leave ticking an afternoon lesson still gets a relief slot', async () => {
    const { admin, sid } = await publishedSeed([...entries(), entry('e-pm', d, 8, [C.c6a], [[S.maths, T.bandara]])]);
    const res = await admin.call('saveReliefDay', req(sid, { leaves: [{ teacherId: T.bandara, type: 'late', entryIds: ['e-pm'] }], reliefs: [pick('e-pm', T.kumara)] }));
    const doc = (await adminDb.doc(paths.reliefDay(sid, YEAR, today.date)).get()).data() as ReliefDay;
    expect(doc.reliefs.map((r) => [r.entryId, r.reliefTeacherId])).toEqual([['e-pm', T.kumara]]);
    expect(res.uncovered).toBe(0);
  });

  it.skipIf(day === null)('does not queue a mail doc synchronously', async () => {
    const { admin, sid } = await publishedSeed(entries());
    const before = (await adminDb.collection('mail').get()).size;
    await admin.call('saveReliefDay', req(sid));
    expect((await adminDb.collection('mail').get()).size).toBe(before);
  });
});
