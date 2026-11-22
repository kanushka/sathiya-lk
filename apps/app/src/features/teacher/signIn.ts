// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { call } from '../../lib/callable';

const KEY = 'sathiya.signInRecorded';

function recorded(mark = false): boolean {
  try {
    if (mark) sessionStorage.setItem(KEY, '1');
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function recordSignIn(): void {
  void call('recordSignIn', {}).then(
    () => recorded(true),
    () => undefined,
  );
}

export function recordSignInOnce(): void {
  if (!recorded()) recordSignIn();
}
