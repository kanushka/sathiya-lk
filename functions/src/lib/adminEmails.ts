// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { auth, db } from './admin';

export async function adminEmails(sid: string): Promise<string[]> {
  const admins = await db.collection(paths.members(sid)).where('role', '==', 'admin').get();
  const emails = await Promise.all(
    admins.docs.map(async (d) => (d.get('email') as string | undefined) || (await auth.getUser(d.id).catch(() => undefined))?.email),
  );
  return emails.filter((e): e is string => !!e);
}
