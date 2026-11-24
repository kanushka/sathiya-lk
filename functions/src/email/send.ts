// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { logger } from 'firebase-functions/v2';
import { db } from '../lib/admin';
import { mailConfig, withSubjectPrefix } from './params';
import type { Rendered } from './templates';

export const MAIL = 'mail';

export interface MailJob {
  to: string[];
  replyTo?: string;
  message: Rendered;
}

// The mail doc the sendMail trigger reads (same shape the Trigger Email extension used), or null with no recipient.
export function mailDoc(job: MailJob): object | null {
  const { from, replyTo, subjectPrefix } = mailConfig();
  const to = [...new Set(job.to.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (!to.length) return null;
  return { to, from: from || undefined, replyTo: job.replyTo || replyTo || undefined, message: { ...job.message, subject: withSubjectPrefix(job.message.subject, subjectPrefix) } };
}

// Queues a mail doc for the sendMail trigger. Throws on failure.
// With `id`, the doc is created once: a repeat with the same id is a no-op.
export async function writeMail(job: MailJob, id?: string): Promise<void> {
  const doc = mailDoc(job);
  if (!doc) return;
  if (id === undefined) {
    await db.collection(MAIL).add(doc);
    return;
  }
  try {
    await db.collection(MAIL).doc(id).create(doc);
  } catch (e) {
    if ((e as { code?: unknown }).code !== 6) throw e;
  }
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
