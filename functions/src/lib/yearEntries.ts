// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type Entry } from '@sathiya/core';
import { db } from './admin';
import { loadEntries } from './loadContext';

export async function latestYearId(sid: string): Promise<string | undefined> {
  const years = await db.collection(paths.years(sid)).get();
  return years.docs
    .map((y) => ({ id: y.id, label: String(y.get('label') ?? '') }))
    .sort((a, b) => b.label.localeCompare(a.label, 'en', { numeric: true }))[0]?.id;
}

// The latest year (highest label) is the draft being edited; older years keep their snapshots.
export async function latestYearEntries(sid: string): Promise<Entry[]> {
  const yid = await latestYearId(sid);
  return yid ? loadEntries(sid, yid) : [];
}
