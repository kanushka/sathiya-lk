// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { colomboToday, paths, reliefKey, type ReliefDay, type ReliefNotified, type SaveReliefDayReq } from '@sathiya/core';
import { C, entry, S, T } from '@sathiya/core/fixtures';
import { FieldValue } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { writeMail } from '../src/email/send';
import { runReliefMail } from '../src/reliefMail';
import { adminDb, uniq, type Client } from './helpers';
import { publishedSeed, putEntries, YEAR } from './seed';

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
const dayDoc = async (sid: string) => (await adminDb.doc(paths.reliefDay(sid, YEAR, today.date)).get()).data() as ReliefDay;
const dropPending = (sid: string, teacherId: string) =>
  adminDb.doc(paths.reliefNotified(sid, YEAR, today.date)).set({ pending: { [teacherId]: FieldValue.delete() } }, { merge: true });

describe.skipIf(day === null)('runReliefMail', () => {
  it('sends one assigned mail', async () => {
    const c = await setup();
    const at = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect(await run(c, at)).toBe('sent');
    const sent = await mails(c.email);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.message.subject).toMatch(/^Relief today: P1 6A /);
    const n = await notified(c.sid);
    expect(n.sent[T.kumara]).toMatchObject({ key: reliefKey((await dayDoc(c.sid)).reliefs, T.kumara) });
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

  it('does not set pending for a teacher without email, and clears a stale one', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect((await notified(c.sid)).pending[T.kumara]).toBe(a1);
    await adminDb.doc(`${paths.teachers(c.sid)}/${T.kumara}`).update({ email: '' });
    const a2 = await save(c, [pick('e-a', null), pick('e-b', T.kumara)], a1);
    expect((await notified(c.sid)).pending?.[T.kumara]).toBeUndefined();
    expect(await run(c, a2)).toBe('superseded');
    expect(await mails(c.email)).toHaveLength(0);
  });

  it('skips when the teacher email vanishes before the task runs', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    await adminDb.doc(`${paths.teachers(c.sid)}/${T.kumara}`).update({ email: '' });
    expect(await run(c, a1)).toBe('skipped');
    const n = await notified(c.sid);
    expect(n.pending[T.kumara]).toBeUndefined();
    expect(n.sent?.[T.kumara]).toBeUndefined();
  });

  it('two runs of one task send once', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect((await Promise.all([run(c, a1), run(c, a1)])).sort()).toEqual(['sent', 'superseded']);
    expect(await mails(c.email)).toHaveLength(1);
  });

  it('skips a task whose Colombo date has passed, clearing only its own token', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    const past = colomboToday(new Date(Date.now() - 86_400_000)).date;
    await adminDb.doc(paths.reliefDay(c.sid, YEAR, past)).set({ ...(await dayDoc(c.sid)), date: past });
    await adminDb.doc(paths.reliefNotified(c.sid, YEAR, past)).set({ sent: {}, pending: { [T.kumara]: a1, [T.herath]: 9 } });
    expect(await runReliefMail({ sid: c.sid, yid: YEAR, date: past, teacherId: T.kumara, savedAt: a1 })).toBe('skipped');
    expect(await mails(c.email)).toHaveLength(0);
    expect(((await adminDb.doc(paths.reliefNotified(c.sid, YEAR, past)).get()).data() as ReliefNotified).pending).toEqual({ [T.herath]: 9 });
  });

  it('an unchanged re-save retries a mail that was never queued, but not one already sent', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    await dropPending(c.sid, T.kumara);
    const a2 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], a1);
    expect((await notified(c.sid)).pending[T.kumara]).toBe(a2);
    expect(await run(c, a2)).toBe('sent');
    const a3 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], a2);
    expect((await notified(c.sid)).pending?.[T.kumara]).toBeUndefined();
    expect(await run(c, a3)).toBe('superseded');
    expect(await mails(c.email)).toHaveLength(1);
  });

  it('an unchanged re-save retries a cancellation that was never queued', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect(await run(c, a1)).toBe('sent');
    const a2 = await save(c, [pick('e-a', null), pick('e-b', null)], a1);
    await dropPending(c.sid, T.kumara);
    const a3 = await save(c, [pick('e-a', null), pick('e-b', null)], a2);
    expect((await notified(c.sid)).pending[T.kumara]).toBe(a3);
    expect(await run(c, a3)).toBe('sent');
    expect((await mails(c.email)).map((m) => m.message.subject)).toContain('Relief cancelled today');
  });

  it('a republish that moves a relieved lesson refreshes the relief and mails the new time', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    expect(await run(c, a1)).toBe('sent');
    await putEntries(c.sid, [entry('e-a', d, 3, [C.c6a], [[S.maths, T.bandara]])]);
    await c.admin.call('publishYear', { schoolId: c.sid, yearId: YEAR });
    const doc = await dayDoc(c.sid);
    expect(doc.updatedAt).toBeGreaterThan(a1);
    expect(doc.reliefs.find((r) => r.entryId === 'e-a')).toMatchObject({ period: 3, reliefTeacherId: T.kumara });
    expect((await notified(c.sid)).pending[T.kumara]).toBe(doc.updatedAt);
    expect(await run(c, doc.updatedAt)).toBe('sent');
    expect((await mails(c.email)).map((m) => m.message.subject)).toContain('Relief today: P3 6A Maths');
  });

  it('a republish that changes no relief leaves the day untouched', async () => {
    const c = await setup();
    const a1 = await save(c, [pick('e-a', T.kumara), pick('e-b', null)], null);
    await c.admin.call('publishYear', { schoolId: c.sid, yearId: YEAR });
    expect((await dayDoc(c.sid)).updatedAt).toBe(a1);
  });

  it('writeMail with an id creates the doc once', async () => {
    const to = `once-${uniq()}@example.test`;
    const job = { to: [to], message: { subject: 's', html: 'h', text: 't' } };
    await writeMail(job, `relief-test-${uniq()}`);
    const id = `relief-test-${uniq()}`;
    await writeMail(job, id);
    await writeMail(job, id);
    expect(await mails(to)).toHaveLength(2);
  });

  it('joins combined classes with +', async () => {
    const { admin, sid } = await publishedSeed([entry('e-ab', d, 1, [C.c6a, C.c6b], [[S.maths, T.bandara]])]);
    const email = `kumara-${uniq()}@example.test`;
    await adminDb.doc(`${paths.teachers(sid)}/${T.kumara}`).update({ email });
    const { updatedAt } = await admin.call('saveReliefDay', {
      schoolId: sid, yearId: YEAR, date: today.date, leaves: [{ teacherId: T.bandara, type: 'full', entryIds: ['e-ab'] }], reliefs: [pick('e-ab', T.kumara)], expectedUpdatedAt: null,
    });
    expect(await runReliefMail({ sid, yid: YEAR, date: today.date, teacherId: T.kumara, savedAt: updatedAt })).toBe('sent');
    expect((await mails(email))[0]!.message.subject).toBe('Relief today: P1 6A+6B Maths');
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
