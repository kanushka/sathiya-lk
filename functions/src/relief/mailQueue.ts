// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type ReliefNotified } from '@sathiya/core';
import { FieldValue } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { logger } from 'firebase-functions/v2';
import { db } from '../lib/admin';

export interface ReliefMailArgs {
  sid: string;
  yid: string;
  date: string;
  teacherId: string;
  savedAt: number;
}

async function enqueueReliefMail(args: ReliefMailArgs): Promise<boolean> {
  // The emulator dispatches task queues at once, ignoring the delay, which races tests that drive runReliefMail themselves.
  if (process.env.FUNCTIONS_EMULATOR === 'true' && process.env.RELIEF_MAIL_EMULATOR !== 'on') return true;
  try {
    await getFunctions().taskQueue('reliefMail').enqueue(args, { scheduleDelaySeconds: 120 });
    return true;
  } catch (e) {
    logger.error('relief mail not queued', e);
    return false;
  }
}

// Never throws: the saved relief stands even if a mail task cannot be queued. Returns how many were queued.
export async function queueReliefMails(day: Omit<ReliefMailArgs, 'teacherId'>, teacherIds: string[]): Promise<number> {
  const ok = await Promise.all(teacherIds.map((teacherId) => enqueueReliefMail({ ...day, teacherId })));
  const failed = teacherIds.filter((_, i) => !ok[i]);
  if (failed.length) {
    const ref = db.doc(paths.reliefNotified(day.sid, day.yid, day.date));
    try {
      await db.runTransaction(async (tx) => {
        const pending = ((await tx.get(ref)).data() as Partial<ReliefNotified> | undefined)?.pending ?? {};
        const stale = failed.filter((t) => pending[t] === day.savedAt);
        if (stale.length) tx.set(ref, { pending: Object.fromEntries(stale.map((t) => [t, FieldValue.delete()])) }, { merge: true });
      });
    } catch (e) {
      logger.error('relief pending not cleared', e);
    }
  }
  return ok.filter(Boolean).length;
}
