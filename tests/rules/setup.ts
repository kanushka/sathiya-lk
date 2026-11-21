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

// s1 = the school under test, s2 = another active school, sd = a disabled school.
export const roles = {
  admin: { uid: 'u-admin', claims: { sid: 's1', role: 'admin' } },
  adminTid: { uid: 'u-admin-t', claims: { sid: 's1', role: 'admin', tid: 't2' } },
  teacher: { uid: 'u-teacher', claims: { sid: 's1', role: 'teacher', tid: 't1' } },
  super: { uid: 'u-super', claims: { super: true } },
  otherAdmin: { uid: 'u-other', claims: { sid: 's2', role: 'admin' } },
  otherTeacher: { uid: 'u-other-t', claims: { sid: 's2', role: 'teacher', tid: 't9' } },
  disabledAdmin: { uid: 'u-dis', claims: { sid: 'sd', role: 'admin' } },
  noClaims: { uid: 'u-new', claims: {} },
} as const;

export type Role = keyof typeof roles | 'anon';

export function as(env: RulesTestEnvironment, role: Role): RulesTestContext {
  if (role === 'anon') return env.unauthenticatedContext();
  const r = roles[role];
  return env.authenticatedContext(r.uid, r.claims);
}
