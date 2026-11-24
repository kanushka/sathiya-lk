// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { ApiErrorCode, CallableName, CallableTypes } from '@sathiya/core';
import { httpsCallable, type HttpsCallableOptions } from 'firebase/functions';
import { functions } from './firebase';

const apiCodes: readonly ApiErrorCode[] = [
  'clash',
  'in-use',
  'not-allowed',
  'invalid',
  'email-unverified',
  'rate-limited',
  'school-disabled',
  'already-linked',
  'staff-id-unknown',
  'link-invalid',
  'too-many-schools',
  'school-registered',
];

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

export const isSchoolDisabled = (err: unknown): boolean => toApiError(err).code === 'school-disabled';

export type CallOptions = Pick<HttpsCallableOptions, 'timeout'>;

export function call<K extends CallableName>(name: K, req: CallableTypes[K]['req'], opts?: CallOptions): Promise<CallableTypes[K]['res']>;
// NoInfer + never defaults keep this overload for explicit call<Req, Res>() only, so untyped calls get CallableTypes.
export function call<Req = never, Res = never>(name: CallableName, req: NoInfer<Req>, opts?: CallOptions): Promise<Res>;
export async function call<Req, Res>(name: CallableName, req: Req, opts?: CallOptions): Promise<Res> {
  try {
    const result = await httpsCallable<Req, Res>(functions, name, opts)(req);
    return result.data;
  } catch (err) {
    throw toApiError(err);
  }
}
