// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { randomInt } from 'node:crypto';

export const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function newPassword(length = 8): string {
  let pw = '';
  for (let i = 0; i < length; i++) pw += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return pw;
}
