// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { getFunctions } from 'firebase-admin/functions';
import { logger } from 'firebase-functions/v2';

export interface ReliefMailArgs {
  sid: string;
  yid: string;
  date: string;
  teacherId: string;
  savedAt: number;
}

// Never throws: the saved relief stands even if the delayed mail task cannot be queued.
export async function enqueueReliefMail(args: ReliefMailArgs): Promise<void> {
  try {
    await getFunctions().taskQueue('reliefMail').enqueue(args, { scheduleDelaySeconds: 120 });
  } catch (e) {
    logger.error('relief mail not queued', e);
  }
}
