// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../../app/AuthProvider';
import { useSchool } from '../../app/SchoolProvider';

type Passwords = Readonly<Record<string, string>>;

const EMPTY: Passwords = {};
let store: Readonly<Record<string, Passwords>> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setSessionPassword(scope: string, teacherId: string, password: string): void {
  store = { ...store, [scope]: { ...store[scope], [teacherId]: password } };
  emit();
}

export function clearSessionPasswords(): void {
  store = {};
  emit();
}

function purgeOtherScopes(scope: string): void {
  const keys = Object.keys(store);
  if (keys.every((k) => k === scope)) return;
  store = scope in store ? { [scope]: store[scope]! } : {};
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSessionPasswords(): { passwords: Passwords; set: (teacherId: string, password: string) => void } {
  const { user } = useAuth();
  const { school } = useSchool();
  const scope = `${user?.uid ?? ''}:${school.id}`;
  const passwords = useSyncExternalStore(subscribe, () => store[scope] ?? EMPTY);
  useEffect(() => purgeOtherScopes(scope), [scope]);
  const set = useCallback((teacherId: string, password: string) => setSessionPassword(scope, teacherId, password), [scope]);
  return { passwords, set };
}
