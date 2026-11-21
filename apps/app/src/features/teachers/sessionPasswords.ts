// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useSyncExternalStore } from 'react';

let passwords: Readonly<Record<string, string>> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setSessionPassword(teacherId: string, password: string): void {
  passwords = { ...passwords, [teacherId]: password };
  emit();
}

export function clearSessionPasswords(): void {
  passwords = {};
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSessionPasswords(): Readonly<Record<string, string>> {
  return useSyncExternalStore(subscribe, () => passwords);
}
