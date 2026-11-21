// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/admin';
import { runTx } from '../src/lib/tx';

const closed = Object.assign(new Error('3 INVALID_ARGUMENT: Transaction is invalid or closed.'), { code: 3 });

afterEach(() => vi.restoreAllMocks());

describe('runTx', () => {
  it('retries the emulator "Transaction is invalid or closed" error', async () => {
    const spy = vi.spyOn(db, 'runTransaction').mockRejectedValueOnce(closed).mockResolvedValueOnce('ok' as never);
    await expect(runTx(async () => 'unused')).resolves.toBe('ok');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors and gives up after the attempt limit', async () => {
    const other = Object.assign(new Error('3 INVALID_ARGUMENT: bad'), { code: 3 });
    const spy = vi.spyOn(db, 'runTransaction').mockRejectedValue(other);
    await expect(runTx(async () => 'x')).rejects.toBe(other);
    expect(spy).toHaveBeenCalledTimes(1);

    const aborted = Object.assign(new Error('10 ABORTED'), { code: 10 });
    spy.mockReset().mockRejectedValue(aborted);
    await expect(runTx(async () => 'x')).rejects.toBe(aborted);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockReset().mockRejectedValue(closed);
    await expect(runTx(async () => 'x', 3)).rejects.toBe(closed);
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
