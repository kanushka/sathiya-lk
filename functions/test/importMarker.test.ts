// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/admin';
import { releaseImportMarker } from '../src/lib/importMarker';

afterEach(() => vi.restoreAllMocks());

describe('releaseImportMarker', () => {
  it('retries a failed delete until the marker is gone', async () => {
    const marker = db.doc('schools/s-release/imports/fp1');
    await marker.set({ createdAt: Date.now() });
    const real = marker.delete.bind(marker);
    const unavailable = Object.assign(new Error('14 UNAVAILABLE'), { code: 14 });
    const spy = vi.spyOn(marker, 'delete').mockRejectedValueOnce(unavailable).mockImplementationOnce(real);

    await expect(releaseImportMarker(marker, 's-release')).resolves.toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
    expect((await marker.get()).exists).toBe(false);
  });

  it('reports failure after the attempt limit instead of throwing', async () => {
    const marker = db.doc('schools/s-release/imports/fp2');
    await marker.set({ createdAt: Date.now() });
    const spy = vi.spyOn(marker, 'delete').mockRejectedValue(Object.assign(new Error('14 UNAVAILABLE'), { code: 14 }));

    await expect(releaseImportMarker(marker, 's-release', 2)).resolves.toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
    expect((await marker.get()).exists).toBe(true);
    await db.doc('schools/s-release/imports/fp2').delete();
  });
});
