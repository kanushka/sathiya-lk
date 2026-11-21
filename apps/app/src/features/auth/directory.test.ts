// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { mergeDirectoryResults, type DirectorySchool } from './directory';

const school = (id: string, nameEn: string, city?: string): DirectorySchool => ({
  id,
  nameEn,
  district: 'Kandy',
  ...(city ? { city } : {}),
  status: 'active',
});

describe('mergeDirectoryResults', () => {
  it('puts name matches first and drops duplicates by id', () => {
    const merged = mergeDirectoryResults(
      [school('a', 'Kandy High', 'Kandy'), school('b', 'Kandy Girls', 'Kandy')],
      [school('b', 'Kandy Girls', 'Kandy'), school('c', 'Siripura', 'Kandy')],
    );
    expect(merged.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('caps the merged list', () => {
    const many = Array.from({ length: 8 }, (_, i) => school(`n${i}`, `N${i}`));
    const more = Array.from({ length: 8 }, (_, i) => school(`c${i}`, `C${i}`));
    expect(mergeDirectoryResults(many, more, 10)).toHaveLength(10);
  });
});
