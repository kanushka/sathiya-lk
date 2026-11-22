// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { REGION } from '../lib/callOptions';
import { mailConfig, withSubjectPrefix } from './params';
import { MAIL } from './send';

export const RESEND_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = defineSecret('RESEND_API_KEY');
const MAX_RETRIES = 3;
const BACKOFF_MS = 1000;
const TIMEOUT_MS = 15_000;
// Worst case is 4 × 15 s requests + 7 s backoff = 67 s.
export const SEND_TIMEOUT_SECONDS = 120;
// Longer than a run can last, so a live claim is never taken over; an expired one means that run died.
const LEASE_MS = (SEND_TIMEOUT_SECONDS + 60) * 1000;

export interface DeliverOptions {
  apiKey: string;
  dryRun: boolean;
  from: string;
  subjectPrefix: string;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

interface MailDoc {
  to?: string[] | string;
  from?: string;
  replyTo?: string;
  message?: { subject?: string; html?: string; text?: string };
  delivery?: { state?: string; leaseExpireTime?: Timestamp };
}

type Attempt = { ok: true; id: string | null } | { ok: false; retry: boolean; error: string };

async function post(body: unknown, key: string, idempotencyKey: string, opts: DeliverOptions): Promise<Attempt> {
  let res: Response;
  try {
    res = await opts.fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { ok: false, retry: true, error: `network error: ${e instanceof Error ? e.message : String(e)}` };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string; name?: string; message?: string };
  if (res.ok) return { ok: true, id: data.id ?? null };
  const error = `${res.status}${data.name ? ` ${data.name}` : ''}: ${data.message ?? res.statusText ?? 'request failed'}`;
  return { ok: false, retry: res.status === 429 || res.status >= 500, error };
}

export type DeliverResult = 'done' | 'skipped' | 'busy';

// Extension-compatible `delivery` field. The claim transaction makes a duplicate trigger event a no-op;
// 'busy' means another run holds a live claim. Rejects only on Firestore errors, so the event can be retried.
export async function deliverMail(ref: DocumentReference, opts: DeliverOptions): Promise<DeliverResult> {
  const claim = await ref.firestore.runTransaction(async (tx): Promise<MailDoc | 'skipped' | 'busy'> => {
    const snap = await tx.get(ref);
    const data = snap.data() as MailDoc | undefined;
    if (!data) return 'skipped';
    const d = data.delivery;
    if (d?.state && d.state !== 'PROCESSING') return 'skipped';
    if (d?.state === 'PROCESSING' && (d.leaseExpireTime?.toMillis() ?? 0) > Date.now()) return 'busy';
    tx.update(ref, {
      delivery: { state: 'PROCESSING', attempts: 0, startTime: FieldValue.serverTimestamp(), endTime: null, leaseExpireTime: Timestamp.fromMillis(Date.now() + LEASE_MS), error: null, info: null },
    });
    return data;
  });
  if (typeof claim === 'string') return claim;
  const mail = claim;

  const finish = async (state: 'SUCCESS' | 'ERROR', attempts: number, info: Record<string, unknown> | null, error: string | null): Promise<DeliverResult> => {
    await ref.update({ 'delivery.state': state, 'delivery.attempts': attempts, 'delivery.endTime': FieldValue.serverTimestamp(), 'delivery.leaseExpireTime': null, 'delivery.info': info, 'delivery.error': error });
    return 'done';
  };

  const to = (Array.isArray(mail.to) ? mail.to : [mail.to]).filter((t): t is string => typeof t === 'string' && !!t.trim());
  if (!to.length) {
    logger.error('mail not sent', { id: ref.id, error: 'no recipient' });
    return finish('ERROR', 0, null, 'mail doc has no recipient');
  }

  const body: Record<string, unknown> = {
    from: mail.from || opts.from,
    to,
    subject: withSubjectPrefix(mail.message?.subject ?? '', opts.subjectPrefix),
    html: mail.message?.html,
    text: mail.message?.text,
  };
  if (mail.replyTo) body.reply_to = mail.replyTo;

  if (opts.dryRun || !opts.apiKey) {
    logger.info('mail dry run (no RESEND_API_KEY or emulator): not sent', { id: ref.id, to, subject: body.subject });
    return finish('SUCCESS', 0, { dryRun: true }, null);
  }

  let attempts = 0;
  for (;;) {
    attempts++;
    const r = await post(body, opts.apiKey, ref.id, opts);
    if (r.ok) {
      logger.info('mail sent', { id: ref.id, messageId: r.id, attempts });
      return finish('SUCCESS', attempts, { messageId: r.id }, null);
    }
    if (!r.retry || attempts > MAX_RETRIES) {
      logger.error('mail not sent', { id: ref.id, attempts, error: r.error });
      return finish('ERROR', attempts, null, r.error);
    }
    await opts.sleep(BACKOFF_MS * 2 ** (attempts - 1));
  }
}

// retry: a run that dies (timeout, crash, failed status write) leaves an expired claim; the redelivered event reclaims it,
// and the doc-id Idempotency-Key stops Resend sending twice. A live claim throws so the event comes back after the lease.
const triggerOpts = { document: `${MAIL}/{id}`, region: REGION, secrets: [RESEND_API_KEY], timeoutSeconds: SEND_TIMEOUT_SECONDS, retry: true };

export const sendMail = onDocumentCreated(triggerOpts, async (event) => {
  if (!event.data) return;
  const { from, subjectPrefix } = mailConfig();
  const result = await deliverMail(event.data.ref, {
    apiKey: RESEND_API_KEY.value().trim(),
    dryRun: process.env.FUNCTIONS_EMULATOR === 'true',
    from,
    subjectPrefix,
    fetch,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
  if (result === 'busy') throw new Error(`mail ${event.data.id} is claimed by another run; retry after the lease`);
});
