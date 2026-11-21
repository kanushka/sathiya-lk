import type { ApiErrorCode, callables } from '@sathiya/core';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const apiCodes: readonly ApiErrorCode[] = ['clash', 'in-use', 'not-allowed', 'invalid'];

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

function isApiCode(v: unknown): v is ApiErrorCode {
  return typeof v === 'string' && (apiCodes as readonly string[]).includes(v);
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = (err ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
  const message = typeof e.message === 'string' ? e.message : String(err);
  const detailCode = (e.details as { code?: unknown } | null | undefined)?.code;
  if (isApiCode(detailCode)) return new ApiError(detailCode, message, e.details);
  const fnCode = typeof e.code === 'string' ? e.code.replace(/^functions\//, '') : '';
  if (fnCode === 'permission-denied' || fnCode === 'unauthenticated') {
    return new ApiError('not-allowed', message, e.details);
  }
  return new ApiError('invalid', message, e.details);
}

export async function call<Req, Res>(name: keyof typeof callables, req: Req): Promise<Res> {
  try {
    const result = await httpsCallable<Req, Res>(functions, name)(req);
    return result.data;
  } catch (err) {
    throw toApiError(err);
  }
}
