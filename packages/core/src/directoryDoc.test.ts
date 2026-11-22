// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { directoryFields, sameDirectory } from './directoryDoc';

describe('directoryFields', () => {
  it('lower-cases name and city for search and defaults status to active', () => {
    const doc = directoryFields({ nameEn: ' Siripura Central College ', city: 'Kandy', district: 'Kandy' });
    expect(doc.nameLower).toBe('siripura central college');
    expect(doc.cityLower).toBe('kandy');
    expect(doc.status).toBe('active');
  });
});

describe('sameDirectory', () => {
  it('is false when a stored doc has an extra field', () => {
    const want = directoryFields({ nameEn: 'A', city: 'B', district: 'C' });
    expect(sameDirectory(want, { ...want })).toBe(true);
    expect(sameDirectory(want, { ...want, extra: 1 })).toBe(false);
  });
});
