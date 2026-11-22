// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { logger } from 'firebase-functions/v2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeMail } from '../src/email/send';
import { deliverMail, RESEND_URL, type DeliverOptions } from '../src/email/sendMail';
import { adminDb, uniq } from './helpers';

// Not `mail`: the emulated trigger would race these tests for the same docs.
const COL = 'mailDeliveryTest';
const FROM = 'Sathiya <noreply@sathiya.kanushka.com>';
const KEY = 're_test_secret_key';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function mailDoc(extra: Record<string, unknown> = {}) {
  const ref = adminDb.collection(COL).doc();
  await ref.set({ to: ['a@example.com'], message: { subject: 'Hello', html: '<p>Hi</p>', text: 'Hi' }, ...extra });
  return ref;
}

let fetchMock: ReturnType<typeof vi.fn>;
let opts: DeliverOptions;

beforeEach(() => {
  fetchMock = vi.fn();
  opts = { apiKey: KEY, dryRun: false, from: FROM, subjectPrefix: '', fetch: fetchMock as unknown as typeof fetch, sleep: async () => undefined };
});
afterEach(() => vi.restoreAllMocks());

const delivery = async (ref: FirebaseFirestore.DocumentReference) => (await ref.get()).get('delivery');
const sentBody = (i = 0) => JSON.parse(fetchMock.mock.calls[i]![1].body as string);

describe('deliverMail', () => {
  it('posts the mail to Resend and records SUCCESS with the message id', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: 'msg_123' }));
    const ref = await mailDoc({ replyTo: 'admin@school.lk' });
    await deliverMail(ref, opts);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(RESEND_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': ref.id });
    expect(sentBody()).toEqual({ from: FROM, to: ['a@example.com'], subject: 'Hello', html: '<p>Hi</p>', text: 'Hi', reply_to: 'admin@school.lk' });

    const d = await delivery(ref);
    expect(d).toMatchObject({ state: 'SUCCESS', attempts: 1, error: null, info: { messageId: 'msg_123' } });
    expect(d.startTime).toBeTruthy();
    expect(d.endTime).toBeTruthy();
  });

  it('uses the doc from over the default and leaves reply_to out when unset', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: 'm' }));
    const ref = await mailDoc({ from: 'Other <x@sathiya.kanushka.com>' });
    await deliverMail(ref, opts);
    expect(sentBody().from).toBe('Other <x@sathiya.kanushka.com>');
    expect(sentBody()).not.toHaveProperty('reply_to');
  });

  it('does not retry a 4xx and records the Resend error', async () => {
    const err = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(json(403, { statusCode: 403, name: 'validation_error', message: 'The sathiya.kanushka.com domain is not verified.' }));
    const ref = await mailDoc();
    await deliverMail(ref, opts);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const d = await delivery(ref);
    expect(d).toMatchObject({ state: 'ERROR', attempts: 1 });
    expect(d.error).toBe('403 validation_error: The sathiya.kanushka.com domain is not verified.');
    expect(JSON.stringify(err.mock.calls)).not.toContain(KEY);
  });

  it('retries a 5xx and a 429 with backoff, then succeeds', async () => {
    const sleep = vi.fn(async () => undefined);
    fetchMock
      .mockResolvedValueOnce(json(500, { message: 'internal' }))
      .mockResolvedValueOnce(json(429, { message: 'slow down' }))
      .mockResolvedValueOnce(json(200, { id: 'msg_ok' }));
    const ref = await mailDoc();
    await deliverMail(ref, { ...opts, sleep });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) expect(init.headers['Idempotency-Key']).toBe(ref.id);
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([1000, 2000]);
    expect(await delivery(ref)).toMatchObject({ state: 'SUCCESS', attempts: 3, error: null, info: { messageId: 'msg_ok' } });
  });

  it('retries network errors and gives up after 3 retries', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const ref = await mailDoc();
    await deliverMail(ref, opts);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const d = await delivery(ref);
    expect(d).toMatchObject({ state: 'ERROR', attempts: 4 });
    expect(d.error).toContain('fetch failed');
  });

  it('skips a doc that is already processing or delivered', async () => {
    for (const state of ['PROCESSING', 'SUCCESS', 'ERROR']) {
      const ref = await mailDoc({ delivery: { state, attempts: 1 } });
      await deliverMail(ref, opts);
      expect((await delivery(ref)).state).toBe(state);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a doc once when the trigger fires twice', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 'once' }));
    const ref = await mailDoc();
    await Promise.all([deliverMail(ref, opts), deliverMail(ref, opts)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await delivery(ref)).state).toBe('SUCCESS');
  });

  it('applies the subject prefix once', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 'p' }));
    const plain = await mailDoc();
    const prefixed = await mailDoc({ message: { subject: '[staging] Hello', html: '<p>Hi</p>', text: 'Hi' } });
    await deliverMail(plain, { ...opts, subjectPrefix: '[staging]' });
    await deliverMail(prefixed, { ...opts, subjectPrefix: '[staging]' });
    expect(sentBody(0).subject).toBe('[staging] Hello');
    expect(sentBody(1).subject).toBe('[staging] Hello');
  });

  it('is a dry run without an API key: no request, SUCCESS with info.dryRun', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const ref = await mailDoc();
    await deliverMail(ref, { ...opts, apiKey: '' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await delivery(ref)).toMatchObject({ state: 'SUCCESS', attempts: 0, error: null, info: { dryRun: true } });
    expect(info).toHaveBeenCalled();
  });

  it('is a dry run when told to (emulator) even with a key', async () => {
    vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const ref = await mailDoc();
    await deliverMail(ref, { ...opts, dryRun: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await delivery(ref)).info).toEqual({ dryRun: true });
  });

  it('records an ERROR without calling Resend when the doc has no recipient', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const ref = await mailDoc({ to: [] });
    await deliverMail(ref, opts);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await delivery(ref)).toMatchObject({ state: 'ERROR', error: 'mail doc has no recipient' });
  });
});

describe('sendMail trigger (emulator)', () => {
  it('marks a queued mail doc as a dry-run SUCCESS', async () => {
    const to = `trigger-${uniq()}@example.com`;
    await writeMail({ to: [to], message: { subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' } });
    const end = Date.now() + 20_000;
    let d: { state?: string; info?: unknown } | undefined;
    while (Date.now() < end) {
      const snap = await adminDb.collection('mail').where('to', 'array-contains', to).get();
      d = snap.docs[0]?.get('delivery');
      if (d?.state === 'SUCCESS') break;
      await new Promise((r) => setTimeout(r, 250));
    }
    expect(d).toMatchObject({ state: 'SUCCESS', attempts: 0, info: { dryRun: true } });
  });
});
