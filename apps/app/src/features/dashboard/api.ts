// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type PublishYearRes } from '@sathiya/core';
import { addDoc, collection } from 'firebase/firestore';
import { call } from '../../lib/callable';
import { db } from '../../lib/firebase';

export async function createYear(schoolId: string, label: string): Promise<string> {
  const ref = await addDoc(collection(db, paths.years(schoolId)), { label: label.trim(), status: 'draft' });
  return ref.id;
}

export function publishYear(schoolId: string, yearId: string): Promise<PublishYearRes> {
  return call('publishYear', { schoolId, yearId });
}
