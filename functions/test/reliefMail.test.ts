// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { colomboToday, paths, type ReliefNotified, type SaveReliefDayReq } from '@sathiya/core';
import { C, entry, S, T } from '@sathiya/core/fixtures';
import { describe, expect, it } from 'vitest';
import { runReliefMail } from '../src/reliefMail';
import { adminDb, uniq, type Client } from './helpers';
import { publishedSeed, YEAR } from './seed';

const today = colomboToday(new Date());
const day = today.day;
const d = day ?? 0;
const entries = () => [entry('e-a', d, 1, [C.c6a], [[S.maths, T.bandara]]), entry('e-b', d, 2, [C.c6a], [[S.science, T.bandara]])];
const leaves = [{ teacherId: T.bandara, type: 'full' as const, entryIds: ['e-a', 'e-b'] }];
const pick = (entryId: string, reliefTeacherId: string | null) => ({ entryId, absentTeacherId: T.bandara, reliefTeacherId }) as unknown as SaveReliefDayReq['reliefs'][number];

interface Ctx { admin: Client; sid: string; email: string }
const setup = async (): Promise<Ctx> => {
  const { admin, sid } = await publishedSeed(entries());
  const email = `kumara-${uniq()}@example.test`;
  await adminDb.doc(`${paths.teachers(sid)}/${T.kumara}`).update({ email });
  return { admin, sid, email };
};
const save = (c: Ctx, reliefs: SaveReliefDayReq['reliefs'], expectedUpdatedAt: number | null) =>
  c.admin.call('saveReliefDay', { schoolId: c.sid, yearId: YEAR, date: today.date, leaves, reliefs, expectedUpdatedAt }).then((r) => r.updatedAt);
const run = (c: Ctx, savedAt: number, teacherId: string = T.kumara) => runReliefMail({ sid: c.sid, yid: YEAR, date: today.date, teacherId, savedAt });
const mails = async (to: string) => (await adminDb.collection('mail').where('to', 'array-contains', to).get()).docs.map((x) => x.data() as { message: { subject: string } });
const notified = async (sid: string) => (await adminDb.doc(paths.reliefNotified(sid, YEAR, today.date)).get()).data() as ReliefNotified;

describe.skipIf(day === null)('runReliefMail', () => {
  it('sends one assigned mail', async () => {
    const c = await setup();
    const at = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect(await run(c, at)).toBe('sent');
    const sent = await mails(c.email);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.message.subject).toMatch(/^Relief today: P1 6A /);
    const n = await notified(c.sid);
    expect(n.sent[T.kumara]).toMatchObject({ key: 'e-a' });
    expect(n.pending[T.kumara]).toBeUndefined();
  });

  it('second run with same state sends nothing', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect(await run(c, a1)).toBe('sent');
    expect(await run(c, a1)).toBe('superseded');
    const a2 = await save(c, [pick('e-a', null), pick('e-b', null)], a1);
    const a3 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], a2);
    expect(await run(c, a3)).toBe('skipped');
    expect(await mails(c.email)).toHaveLength(1);
  });

  it('superseded when doc saved later', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    const a2 = await save(c, [pick('e-a', T.kumara), pick('e-b', T.kumara)], a1);
    expect(await run(c, a1)).toBe('superseded');
    expect(await mails(c.email)).toHaveLength(0);
    expect(await run(c, a2)).toBe('sent');
    const sent = await mails(c.email);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.message.subject).toBe('2 relief periods today');
  });

  it("a later save that changes only another teacher does not cancel this teacher's mail", async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    await save(c, [pick('e-a', T.kumara), pick('e-b', T.herath)], a1);
    expect((await notified(c.sid)).pending[T.kumara]).toBe(a1);
    expect(await run(c, a1)).toBe('sent');
    expect(await mails(c.email)).toHaveLength(1);
  });

  it('cancels only after a prior email', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    const a2 = await save(c, [pick('e-a', null), pick('e-b', null)], a1);
    expect(await run(c, a2)).toBe('skipped');
    expect(await mails(c.email)).toHaveLength(0);

    const a3 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], a2);
    expect(await run(c, a3)).toBe('sent');
    const a4 = await save(c, [pick('e-a', null), pick('e-b', null)], a3);
    expect(await run(c, a4)).toBe('sent');
    expect((await mails(c.email)).map((m) => m.message.subject)).toContain('Relief cancelled today');
  });

  it('skips teacher without email and clears pending', async () => {
    const c = await setup();
    await adminDb.doc(`${paths.teachers(c.sid)}/${T.kumara}`).update({ email: '' });
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect(await run(c, a1)).toBe('skipped');
    const n = await notified(c.sid);
    expect(n.pending[T.kumara]).toBeUndefined();
    expect(n.sent?.[T.kumara]).toBeUndefined();
  });

  it('falls back to the linked member email', async () => {
    const c = await setup();
    const uid = `u-${uniq()}`;
    const memberEmail = `member-${uniq()}@example.test`;
    await adminDb.doc(`${paths.teachers(c.sid)}/${T.kumara}`).update({ email: '', uid });
    await adminDb.doc(`${paths.members(c.sid)}/${uid}`).set({ uid, role: 'teacher', teacherId: T.kumara, email: memberEmail });
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect(await run(c, a1)).toBe('sent');
    expect(await mails(memberEmail)).toHaveLength(1);
  });
});
