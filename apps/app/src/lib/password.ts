// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export const MIN_PASSWORD_LENGTH = 8;

export function passwordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
