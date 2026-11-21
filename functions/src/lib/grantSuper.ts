// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Auth } from 'firebase-admin/auth';

export async function grantSuper(auth: Pick<Auth, 'getUserByEmail' | 'setCustomUserClaims'>, email: string): Promise<{ uid: string; claims: Record<string, unknown> }> {
  const user = await auth.getUserByEmail(email.trim());
  const claims = { ...user.customClaims, super: true };
  await auth.setCustomUserClaims(user.uid, claims);
  return { uid: user.uid, claims };
}
