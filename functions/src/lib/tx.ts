// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Transaction } from 'firebase-admin/firestore';
import { db } from './admin';

// The SDK retries ABORTED itself. Under lock contention the Firestore emulator can instead kill a waiting transaction and
// answer its next read with INVALID_ARGUMENT "Transaction is invalid or closed", which the SDK does not retry.
const retryable = (e: unknown): boolean => {
  const { code, message } = (e ?? {}) as { code?: unknown; message?: unknown };
  return code === 10 || (code === 3 && typeof message === 'string' && message.includes('Transaction is invalid or closed'));
};

export async function runTx<T>(fn: (tx: Transaction) => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await db.runTransaction(fn);
    } catch (e) {
      if (i >= attempts || !retryable(e)) throw e;
      await new Promise((r) => setTimeout(r, 50 * 2 ** i + Math.random() * 50));
    }
  }
}
