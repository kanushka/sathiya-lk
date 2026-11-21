import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    await expect(call('saveEntry', { a: 1 })).resolves.toEqual({ entryId: 'e9' });
    expect(httpsCallable).toHaveBeenCalledWith({ region: 'test' }, 'saveEntry');
    expect(calls).toEqual([{ a: 1 }]);
  });

  it('rejects with a mapped ApiError', async () => {
    respond = async () => {
      throw fnError('permission-denied', 'nope');
    };
    const err = await call('saveEntry', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).code).toBe('not-allowed');
    expect((err as Error).message).toBe('nope');
  });
});
