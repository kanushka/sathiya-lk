// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type ReliefNotified } from '@sathiya/core';
import { describe, expect, it, vi } from 'vitest';
import { adminDb, uniq } from './helpers';
import { queueReliefMails } from '../src/relief/mailQueue';

const enqueue = vi.hoisted(() => vi.fn());
vi.mock('firebase-admin/functions', () => ({ getFunctions: () => ({ taskQueue: () => ({ enqueue }) }) }));

const YID = 'y2027';
const DATE = '2026-11-24';

describe('queueReliefMails', () => {
  it('clears pending and does not count a teacher whose task cannot be queued', async () => {
    const sid = `s-${uniq()}`;
    const ref = adminDb.doc(paths.reliefNotified(sid, YID, DATE));
    await ref.set({ sent: {}, pending: { ok: 5, down: 5 } });
    enqueue.mockImplementation(async (args: { teacherId: string }) => {
      if (args.teacherId === 'down') throw new Error('queue down');
    });
    const queued = await queueReliefMails({ sid, yid: YID, date: DATE, savedAt: 5 }, ['ok', 'down']);
    expect(queued).toBe(1);
    expect(((await ref.get()).data() as ReliefNotified).pending).toEqual({ ok: 5 });
  });

  it('keeps a newer pending mark from a later save', async () => {
    const sid = `s-${uniq()}`;
    const ref = adminDb.doc(paths.reliefNotified(sid, YID, DATE));
    await ref.set({ sent: {}, pending: { down: 9 } });
    enqueue.mockRejectedValue(new Error('queue down'));
    expect(await queueReliefMails({ sid, yid: YID, date: DATE, savedAt: 5 }, ['down'])).toBe(0);
    expect(((await ref.get()).data() as ReliefNotified).pending).toEqual({ down: 9 });
  });
});
