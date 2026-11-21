// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { logger } from 'firebase-functions/v2';
import { db } from '../lib/admin';
import { mailConfig } from './params';
import type { Rendered } from './templates';

export const MAIL = 'mail';

export interface MailJob {
  to: string[];
  replyTo?: string;
  message: Rendered;
}

// Document shape of the Trigger Email from Firestore extension. Throws on failure.
export async function writeMail(job: MailJob): Promise<void> {
  const { from, replyTo } = mailConfig();
  const to = [...new Set(job.to.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (!to.length) return;
  await db.collection(MAIL).add({ to, from: from || undefined, replyTo: job.replyTo || replyTo || undefined, message: job.message });
}

// For mail that is a side effect of a callable: never throws; a failure is logged and the callable's own work stands.
export async function sendMail(label: string, build: () => Promise<MailJob | undefined>): Promise<void> {
  try {
    const job = await build();
    if (job) await writeMail(job);
  } catch (e) {
    logger.error(`mail ${label} not sent`, e);
  }
}
