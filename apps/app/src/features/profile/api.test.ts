// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { updateDoc } from 'firebase/firestore';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/firebase', () => ({ db: {}, functions: {} }));
vi.mock('firebase/firestore', () => ({ deleteField: vi.fn(() => 'DELETE'), doc: vi.fn(), updateDoc: vi.fn() }));

import { updateSchool } from './api';

const base = { city: 'Kandy', staffPrefix: 'SCC', colors: { primary: '#000000', second: '#FFFFFF' } };
const written = () => vi.mocked(updateDoc).mock.calls.at(-1)![1] as unknown as Record<string, unknown>;

describe('updateSchool', () => {
  it('leaves nameSi out of the write when the patch omits it', async () => {
    await updateSchool('s1', base);
    expect(written()).not.toHaveProperty('nameSi');
    expect(written()).not.toHaveProperty('nameEn');
  });

  it('clears nameSi when the patch sets it blank', async () => {
    await updateSchool('s1', { ...base, nameEn: 'X', nameSi: undefined });
    expect(written().nameSi).toBe('DELETE');
    await updateSchool('s1', { ...base, nameEn: 'X', nameSi: 'නම' });
    expect(written().nameSi).toBe('නම');
  });
});
