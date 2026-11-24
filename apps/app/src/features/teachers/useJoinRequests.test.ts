// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useJoinRequests } from './useJoinRequests';

const docs = [
  { id: 'a', uid: 'a', status: 'pending' },
  { id: 'b', uid: 'b', status: 'rejected' },
  { id: 'c', uid: 'c' },
];
vi.mock('../../lib/firestore', () => ({ useCollection: (path: string | null) => ({ data: path ? docs : [], loading: false }) }));

describe('useJoinRequests', () => {
  it('returns only pending requests', () => {
    const { result } = renderHook(() => useJoinRequests('s1'));
    expect(result.current.data.map((r) => r.uid)).toEqual(['a', 'c']);
  });
});
