// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { similarSchools } from './similar';

const pool = [
  { id: 'a', name: 'KOTAHENA MAHA VIDYALAYA' },
  { id: 'b', name: 'Kotahena Kumara V.' },
  { id: 'c', name: 'Royal College' },
  { id: 'd', name: 'Ananda College, Colombo 10' },
  { id: 'e', name: 'Kotahena Central College' },
];

describe('similarSchools', () => {
  it('matches the same school despite common words and case', () => {
    const r = similarSchools('Kotahena M.M.V.', pool);
    expect(r.map((m) => m.id)).toContain('a');
  });
  it('excludes unrelated names', () => {
    const r = similarSchools('Kotahena M.M.V.', pool);
    expect(r.map((m) => m.id)).not.toContain('c');
    expect(r.map((m) => m.id)).not.toContain('d');
  });
  it('ranks exact above partial', () => {
    const r = similarSchools('Kotahena Kumara V.', pool);
    expect(r[0]!.id).toBe('b');
    expect(r[0]!.score).toBeGreaterThan(0.9);
  });
  it('tolerates a typo', () => {
    expect(similarSchools('Kotahena Kumaara', pool).map((m) => m.id)).toContain('b');
  });
  it('respects limit and empty input', () => {
    expect(similarSchools('Kotahena', pool, 1)).toHaveLength(1);
    expect(similarSchools('', pool)).toEqual([]);
    expect(similarSchools('x', [])).toEqual([]);
  });
});
