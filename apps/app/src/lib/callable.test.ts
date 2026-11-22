// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { SaveEntryRes } from '@sathiya/core';
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

const calls: unknown[] = [];
let respond: (req: unknown) => Promise<unknown> = async () => undefined;
// A plain function, not vi.fn: spies re-chain returned promises and flag handled rejections as unhandled.
const invoke = (req: unknown) => {
  calls.push(req);
  return respond(req);
};
vi.mock('./firebase', () => ({ functions: { region: 'test' } }));
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => invoke),
}));

const { ApiError, call, toApiError } = await import('./callable');
const { httpsCallable } = await import('firebase/functions');

function fnError(code: string, message: string, details?: unknown) {
  return Object.assign(new Error(message), { code: `functions/${code}`, details });
}

describe('toApiError', () => {
  it('uses an ApiErrorCode from details', () => {
    const e = toApiError(fnError('failed-precondition', 'clash', { code: 'clash', with: ['e1'] }));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('clash');
    expect(e.details).toEqual({ code: 'clash', with: ['e1'] });
    expect(e.message).toBe('clash');
  });

  it('maps registration and report error codes from details', () => {
    for (const code of ['census-taken', 'email-unverified', 'already-has-school', 'rate-limited', 'school-disabled'] as const) {
      expect(toApiError(fnError('failed-precondition', code, { code })).code).toBe(code);
    }
  });

  it('ignores unknown detail codes', () => {
    expect(toApiError(fnError('internal', 'x', { code: 'weird' })).code).toBe('invalid');
  });

  it.each([
    ['permission-denied', 'not-allowed'],
    ['unauthenticated', 'not-allowed'],
    ['invalid-argument', 'invalid'],
    ['failed-precondition', 'invalid'],
    ['not-found', 'invalid'],
    ['already-exists', 'invalid'],
    ['internal', 'invalid'],
  ])('maps %s to %s', (code, expected) => {
    expect(toApiError(fnError(code, 'boom')).code).toBe(expected);
  });

  it('keeps the original message for unknown errors', () => {
    const e = toApiError(new Error('network down'));
    expect(e.code).toBe('invalid');
    expect(e.message).toBe('network down');
  });

  it('returns ApiError unchanged', () => {
    const original = new ApiError('in-use', 'used');
    expect(toApiError(original)).toBe(original);
  });
});

describe('call', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('returns the callable data', async () => {
    respond = async () => ({ data: { entryId: 'e9' } });
    await expect(call<{ a: number }, unknown>('saveEntry', { a: 1 })).resolves.toEqual({ entryId: 'e9' });
    expect(httpsCallable).toHaveBeenCalledWith({ region: 'test' }, 'saveEntry', undefined);
    expect(calls).toEqual([{ a: 1 }]);
  });

  it('passes a client timeout through', async () => {
    respond = async () => ({ data: {} });
    await call<object, unknown>('importSetup', {}, { timeout: 310_000 });
    expect(httpsCallable).toHaveBeenCalledWith({ region: 'test' }, 'importSetup', { timeout: 310_000 });
  });

  it('infers request and response types from the callable name', async () => {
    respond = async () => ({ data: { entryId: 'e1' } });
    const req = { schoolId: 's', yearId: 'y', entry: { day: 0 as const, period: 1, classIds: ['c'], lessons: [] } };
    const typed = call('saveEntry', req);
    expectTypeOf(typed).toEqualTypeOf<Promise<SaveEntryRes>>();
    expectTypeOf(call<{ a: number }, { b: string }>('publishYear', { a: 1 })).toEqualTypeOf<Promise<{ b: string }>>();
    await expect(typed).resolves.toEqual({ entryId: 'e1' });
  });

  it('rejects with a mapped ApiError', async () => {
    respond = async () => {
      throw fnError('permission-denied', 'nope');
    };
    const err = await call<object, unknown>('saveEntry', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).code).toBe('not-allowed');
    expect((err as Error).message).toBe('nope');
  });
});
