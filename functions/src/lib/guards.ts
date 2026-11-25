// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { EMAIL_RE, isSchoolAdmin, paths, type ApiErrorCode, type Claims, type Member, type School } from '@sathiya/core';
import { HttpsError, type CallableRequest, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { db } from './admin';

export function fail(code: FunctionsErrorCode, apiCode: ApiErrorCode, message: string, extra: Record<string, unknown> = {}): never {
  throw new HttpsError(code, message, { code: apiCode, ...extra });
}

export const invalid = (message: string): never => fail('invalid-argument', 'invalid', message);
export const notAllowed = (message = 'Not allowed'): never => fail('permission-denied', 'not-allowed', message);
export const schoolDisabled = (): never => fail('failed-precondition', 'school-disabled', 'School is suspended');

export interface Caller {
  uid: string;
  claims: Claims;
  token: NonNullable<CallableRequest['auth']>['token'];
}

export function requireAuth(req: CallableRequest): Caller {
  if (!req.auth) fail('unauthenticated', 'not-allowed', 'Sign in required');
  const { uid, token } = req.auth;
  const claims: Claims = { schools: token.schools, super: token.super === true };
  return { uid, claims, token };
}

// The sign-in provider is no proof: a Google identity linked to an unverified password account carries its email unverified.
export const isVerified = (token: Caller['token']): boolean => token.email_verified === true;

export function requireSuper(req: CallableRequest): Caller {
  const caller = requireAuth(req);
  if (!caller.claims.super) notAllowed('Super admin only');
  return caller;
}

export const isAdminOf = (claims: Claims, sid: string): boolean => isSchoolAdmin(claims, sid);

// Admin of sid, school exists and is not disabled. Reuse for every school-scoped admin callable.
// The member doc is checked too: claims of a removed admin stay valid until their ID token expires.
export async function requireSchoolAdmin(req: CallableRequest, sid: unknown): Promise<Caller & { sid: string; school: Omit<School, 'id'> }> {
  const caller = requireAuth(req);
  const schoolId = docId(sid, 'schoolId');
  if (!isAdminOf(caller.claims, schoolId)) notAllowed('Not an admin of this school');
  const [snap, member] = await Promise.all([db.doc(paths.school(schoolId)).get(), db.doc(`${paths.members(schoolId)}/${caller.uid}`).get()]);
  if ((member.data() as Member | undefined)?.role !== 'admin') notAllowed('Not an admin of this school');
  const school = snap.data() as Omit<School, 'id'> | undefined;
  if (!school) notAllowed('School is not active');
  if (school!.status === 'disabled') schoolDisabled();
  return { ...caller, sid: schoolId, school: school! };
}

export function obj(v: unknown, name: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) invalid(`${name} must be an object`);
  return v as Record<string, unknown>;
}

export function str(v: unknown, name: string, max = 200): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) invalid(`${name} is required`);
  return (v as string).trim();
}

export function optStr(v: unknown, name: string, max = 200): string | undefined {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return undefined;
  return str(v, name, max);
}

// Names may be given in English, Sinhala or both; at least one is required.
export function twoNames(en: unknown, si: unknown, enField: string, siField: string): { en: string; si?: string } {
  const e = optStr(en, enField) ?? '';
  const s = optStr(si, siField);
  if (!e && !s) invalid(`${enField} or ${siField} is required`);
  return s === undefined ? { en: e } : { en: e, si: s };
}

export function bool(v: unknown, name: string): boolean {
  if (typeof v !== 'boolean') invalid(`${name} must be a boolean`);
  return v as boolean;
}

export function int(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) invalid(`${name} must be an integer ${min}–${max}`);
  return v as number;
}

export function optInt(v: unknown, name: string, min: number, max: number): number | undefined {
  if (v === undefined || v === null) return undefined;
  return int(v, name, min, max);
}

export function intList(v: unknown, name: string, min: number, max: number): number[] {
  if (!Array.isArray(v)) invalid(`${name} must be a list`);
  return [...new Set((v as unknown[]).map((x) => int(x, name, min, max)))].sort((a, b) => a - b);
}

export function strList(v: unknown, name: string): string[] {
  if (!Array.isArray(v)) invalid(`${name} must be a list`);
  return [...new Set((v as unknown[]).map((x) => str(x, name)))];
}

// A single Firestore path segment: no '/', not '.' or '..', not __reserved__, ≤ 1500 bytes. Not trimmed.
export function docId(v: unknown, name: string): string {
  if (
    typeof v !== 'string' ||
    !v ||
    v !== v.trim() ||
    v.includes('/') ||
    v === '.' ||
    v === '..' ||
    /^__.*__$/.test(v) ||
    Buffer.byteLength(v, 'utf8') > 1500
  ) {
    invalid(`${name} is not a valid id`);
  }
  return v as string;
}

export const optDocId = (v: unknown, name: string): string | undefined =>
  v === undefined || v === null || v === '' ? undefined : docId(v, name);

export function docIdList(v: unknown, name: string): string[] {
  if (!Array.isArray(v)) invalid(`${name} must be a list`);
  return [...new Set((v as unknown[]).map((x) => docId(x, name)))];
}

export function email(v: unknown, name = 'email'): string {
  const e = str(v, name, 254).toLowerCase();
  if (!EMAIL_RE.test(e)) fail('invalid-argument', 'invalid', `${name} is not a valid email`, { field: name });
  return e;
}
