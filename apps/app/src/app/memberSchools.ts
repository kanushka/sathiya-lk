// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, pickName, type Lang, type School } from '@sathiya/core';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function fetchSchoolNames(ids: string[], lang: Lang): Promise<Record<string, string>> {
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, paths.school(id)));
        return [id, snap.exists() ? pickName(snap.data() as School, lang) : id] as const;
      } catch {
        return [id, id] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
