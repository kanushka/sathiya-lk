// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface SchoolPatch {
  nameEn: string;
  nameSi?: string | undefined;
  city: string;
  district: string;
  address?: string | undefined;
  phone?: string | undefined;
  staffPrefix: string;
  colors: { primary: string; second: string };
}

const optional = (v: string | undefined) => (v === undefined || v.trim() === '' ? deleteField() : v.trim());

export async function updateSchool(schoolId: string, patch: SchoolPatch): Promise<void> {
  await updateDoc(doc(db, paths.school(schoolId)), {
    nameEn: patch.nameEn.trim(),
    nameSi: optional(patch.nameSi),
    city: patch.city.trim(),
    district: patch.district.trim(),
    address: optional(patch.address),
    phone: optional(patch.phone),
    staffPrefix: patch.staffPrefix,
    colors: { primary: patch.colors.primary, second: patch.colors.second },
  });
}
