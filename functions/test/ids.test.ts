// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { C, S, T } from '@sathiya/core/fixtures';
import { httpsCallable } from 'firebase/functions';
import { beforeAll, describe, it } from 'vitest';
import { client, expectFnError, makeSuper, signUp, teacherInput, type Client } from './helpers';
import { draft, seededSchool, YEAR } from './seed';

const BAD = ['.', '..', 'a/b', '__x__', 'x'.repeat(1501)];

let admin: Client;
let sid: string;
beforeAll(async () => {
  ({ admin, sid } = await seededSchool());
});

const call = (c: Client, name: string, data: unknown) => httpsCallable(c.functions, name)(data);
const ok = () => draft(0, 2, [C.c6a], [[S.maths, T.bandara]]);

describe.each(BAD)('client-supplied id %j', (bad) => {
  const cases: Array<[string, () => [string, unknown]]> = [
    ['schoolId (admin callable)', () => ['publishYear', { schoolId: bad, yearId: YEAR }]],
    ['saveEntry yearId', () => ['saveEntry', { schoolId: sid, yearId: bad, entry: ok() }]],
    ['saveEntry entry.id', () => ['saveEntry', { schoolId: sid, yearId: YEAR, entry: { ...ok(), id: bad } }]],
    ['saveEntry classIds', () => ['saveEntry', { schoolId: sid, yearId: YEAR, entry: { ...ok(), classIds: [bad] } }]],
    ['saveEntry subjectId', () => ['saveEntry', { schoolId: sid, yearId: YEAR, entry: draft(0, 2, [C.c6a], [[bad, T.bandara]]) }]],
    ['saveEntry teacherId', () => ['saveEntry', { schoolId: sid, yearId: YEAR, entry: draft(0, 2, [C.c6a], [[S.maths, bad]]) }]],
    ['deleteEntry yearId', () => ['deleteEntry', { schoolId: sid, yearId: bad, entryId: 'e1' }]],
    ['deleteEntry entryId', () => ['deleteEntry', { schoolId: sid, yearId: YEAR, entryId: bad }]],
    ['deleteSetupItem id', () => ['deleteSetupItem', { schoolId: sid, kind: 'subject', id: bad }]],
    ['publishYear yearId', () => ['publishYear', { schoolId: sid, yearId: bad }]],
    ['createTeacher subjectIds', () => ['createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC099'), subjectIds: [bad] } }]],
    ['inviteAdmin teacherId', () => ['inviteAdmin', { schoolId: sid, email: 'x@example.com', teacherId: bad }]],
  ];
  it.each(cases)('%s → invalid-argument', async (_, make) => {
    const [name, data] = make();
    await expectFnError(call(admin, name, data), 'invalid-argument', 'invalid');
  });

  it('setSchoolStatus schoolId → invalid-argument', async () => {
    const s = await signUp();
    await makeSuper(s);
    await expectFnError(call(s, 'setSchoolStatus', { schoolId: bad, status: 'disabled' }), 'invalid-argument', 'invalid');
  });

  it('reportSchool schoolId → invalid-argument', async () => {
    await expectFnError(call(client(), 'reportSchool', { schoolId: bad, reason: 'fake' }), 'invalid-argument', 'invalid');
  });
});
