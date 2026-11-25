// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const PROJECT_ID = 'demo-sathiya-rules';
const HOST = '127.0.0.1';
const root = (f: string) => fileURLToPath(new URL(`../../${f}`, import.meta.url));

export function initEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: HOST, port: 8080, rules: readFileSync(root('firestore.rules'), 'utf8') },
    storage: { host: HOST, port: 9199, rules: readFileSync(root('storage.rules'), 'utf8') },
  });
}

// s1 = the school under test, s2 = another active school, sd = a disabled school, sp = pending review, sr = rejected.
export const roles = {
  admin: { uid: 'u-admin', claims: { schools: { s1: { r: 'a' } } } },
  adminTid: { uid: 'u-admin-t', claims: { schools: { s1: { r: 'a', t: 't2' } } } },
  teacher: { uid: 'u-teacher', claims: { schools: { s1: { r: 't', t: 't1' } } } },
  super: { uid: 'u-super', claims: { super: true } },
  otherAdmin: { uid: 'u-other', claims: { schools: { s2: { r: 'a' } } } },
  otherTeacher: { uid: 'u-other-t', claims: { schools: { s2: { r: 't', t: 't9' } } } },
  disabledAdmin: { uid: 'u-dis', claims: { schools: { sd: { r: 'a' } } } },
  disabledTeacher: { uid: 'u-dis-t', claims: { schools: { sd: { r: 't', t: 'td' } } } },
  pendingAdmin: { uid: 'u-pend', claims: { schools: { sp: { r: 'a' } } } },
  rejectedAdmin: { uid: 'u-rej', claims: { schools: { sr: { r: 'a' } } } },
  multiTeacher: { uid: 'u-multi', claims: { schools: { s1: { r: 't', t: 't1' }, s2: { r: 't', t: 't9' } } } },
  adminS1TeacherS2: { uid: 'u-mixed', claims: { schools: { s1: { r: 'a' }, s2: { r: 't', t: 't9' } } } },
  noClaims: { uid: 'u-new', claims: {} },
} as const;

export type Role = keyof typeof roles | 'anon';

export function as(env: RulesTestEnvironment, role: Role): RulesTestContext {
  if (role === 'anon') return env.unauthenticatedContext();
  const r = roles[role];
  return env.authenticatedContext(r.uid, r.claims);
}
