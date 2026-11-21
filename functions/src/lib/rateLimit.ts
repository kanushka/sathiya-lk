// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db } from './admin';
import { fail } from './guards';
import { runTx } from './tx';

export const REGISTER_PER_UID_PER_DAY = 3;
export const REGISTER_PER_IP_PER_DAY = 10;
export const REPORT_PER_IP_PER_DAY = 10;

export const RATE_LIMITS = 'rateLimits';
const DAY_MS = 86_400_000;

export interface Limit {
  scope: string;
  id: string;
  max: number;
}

// Rightmost X-Forwarded-For hop: the one Google's front end appends; hops before it are client-supplied. Else the socket IP.
export function clientIp(req: CallableRequest): string {
  const raw = req.rawRequest;
  const xff = raw?.headers?.['x-forwarded-for'];
  const hops = (Array.isArray(xff) ? xff.join(',') : (xff ?? '')).split(',').map((h) => h.trim()).filter(Boolean);
  return hops[hops.length - 1] || raw?.ip || 'unknown';
}

export const hashIp = (ip: string): string => createHash('sha256').update(ip).digest('hex');

// All counters checked and incremented in one transaction; nothing is counted when any limit is already reached.
export async function consumeRateLimits(limits: Limit[], now = Date.now()): Promise<void> {
  const day = new Date(now).toISOString().slice(0, 10);
  const refs = limits.map((l) => db.collection(RATE_LIMITS).doc(`${l.scope}_${day}_${l.id}`));
  const expiresAt = Timestamp.fromMillis(Date.parse(day) + 2 * DAY_MS);
  await runTx(async (tx) => {
    const snaps = await tx.getAll(...refs);
    const counts = snaps.map((s) => (s.get('count') as number | undefined) ?? 0);
    counts.forEach((n, i) => {
      if (n >= limits[i]!.max) fail('resource-exhausted', 'rate-limited', 'Too many attempts today, try again tomorrow');
    });
    refs.forEach((ref, i) => tx.set(ref, { scope: limits[i]!.scope, day, count: counts[i]! + 1, expiresAt }));
  });
}
