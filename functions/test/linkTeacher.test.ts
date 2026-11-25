// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { fileJoinRequest } from '../src/lib/joinRequest';
import { linkTeacher, type LinkOpts } from '../src/lib/linkTeacher';
import { runTx } from '../src/lib/tx';
import { adminDb, adminWithSchool, signUp, teacherInput } from './helpers';

const link = (sid: string, teacherId: string, uid: string, opts: LinkOpts = {}) => runTx((tx) => linkTeacher(tx, sid, teacherId, uid, opts));
const teacherDoc = async (sid: string, id: string) => (await adminDb.doc(`${paths.teachers(sid)}/${id}`).get()).data()!;
const memberDoc = async (sid: string, uid: string) => (await adminDb.doc(`${paths.members(sid)}/${uid}`).get()).data();
const request = (sid: string, uid: string, teacherId: string) =>
  adminDb.doc(`${paths.joinRequests(sid)}/${uid}`).set({ uid, email: 'x@example.com', staffId: 'SCC001', teacherId, createdAt: Date.now() });

async function setup(staffId = 'SCC001') {
  const { admin, sid } = await adminWithSchool();
  const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput(staffId) });
  return { admin, sid, teacherId, user: await signUp() };
}

describe('linkTeacher', () => {
  it('sets the teacher uid and writes a teacher member', async () => {
    const { sid, teacherId, user } = await setup();
    await link(sid, teacherId, user.uid, { email: 'x@example.com', name: 'Nimal' });
    expect((await teacherDoc(sid, teacherId)).uid).toBe(user.uid);
    expect(await memberDoc(sid, user.uid)).toEqual({ uid: user.uid, role: 'teacher', teacherId, email: 'x@example.com', name: 'Nimal' });
  });

  it('keeps role admin for an existing admin member and keeps their name', async () => {
    const { admin, sid, teacherId } = await setup();
    await link(sid, teacherId, admin.uid, { name: 'Other' });
    expect(await memberDoc(sid, admin.uid)).toMatchObject({ role: 'admin', teacherId, name: 'Principal' });
  });

  it('writes role admin when asked', async () => {
    const { sid, teacherId, user } = await setup();
    await link(sid, teacherId, user.uid, { role: 'admin' });
    expect(await memberDoc(sid, user.uid)).toMatchObject({ role: 'admin', teacherId });
  });

  it('deletes the linking user request, rejects other requests for that teacher, leaves others', async () => {
    const { admin, sid, teacherId, user } = await setup();
    const { teacherId: other } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC002') });
    const rival = await signUp();
    const bystander = await signUp();
    await request(sid, user.uid, teacherId);
    await request(sid, rival.uid, teacherId);
    await request(sid, bystander.uid, other);
    await link(sid, teacherId, user.uid);
    const left = await adminDb.collection(paths.joinRequests(sid)).get();
    expect(left.docs.map((d) => d.id).sort()).toEqual([bystander.uid, rival.uid].sort());
    const rivalDoc = left.docs.find((d) => d.id === rival.uid)!.data();
    expect(rivalDoc).toMatchObject({ status: 'rejected', teacherId });
    expect(typeof rivalDoc.decidedAt).toBe('number');
    expect(left.docs.find((d) => d.id === bystander.uid)!.data().status).toBeUndefined();
  });

  it('fails already-linked when the teacher has a uid, changing nothing', async () => {
    const { sid, teacherId, user } = await setup();
    const first = await signUp();
    await link(sid, teacherId, first.uid);
    await request(sid, user.uid, teacherId);
    await expect(link(sid, teacherId, user.uid)).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'already-linked', reason: 'teacher' } });
    expect((await teacherDoc(sid, teacherId)).uid).toBe(first.uid);
    expect(await memberDoc(sid, user.uid)).toBeUndefined();
    expect((await adminDb.doc(`${paths.joinRequests(sid)}/${user.uid}`).get()).exists).toBe(true);
  });

  it('fails already-linked when the uid already has a teacher in this school', async () => {
    const { admin, sid, teacherId, user } = await setup();
    await link(sid, teacherId, user.uid);
    const { teacherId: second } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC002') });
    await expect(link(sid, second, user.uid)).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'already-linked', reason: 'account' } });
    expect((await teacherDoc(sid, second)).uid).toBeUndefined();
  });

  it('allows the same uid to link a teacher in another school', async () => {
    const { sid, teacherId, user } = await setup();
    const other = await setup('SCC001');
    await link(sid, teacherId, user.uid);
    await link(other.sid, other.teacherId, user.uid);
    expect((await teacherDoc(other.sid, other.teacherId)).uid).toBe(user.uid);
  });

  it('lets exactly one of two concurrent links win', async () => {
    const { sid, teacherId } = await setup();
    const [a, b] = [await signUp(), await signUp()];
    const results = await Promise.allSettled([link(sid, teacherId, a.uid), link(sid, teacherId, b.uid)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const winner = (await teacherDoc(sid, teacherId)).uid as string;
    expect([a.uid, b.uid]).toContain(winner);
    const members = await adminDb.collection(paths.members(sid)).get();
    expect(members.docs.map((d) => d.id).filter((id) => id === a.uid || id === b.uid)).toEqual([winner]);
  });

  it('refuses when the teacher email no longer matches the email the caller matched on', async () => {
    const { admin, sid, user } = await setup();
    const { teacherId } = await admin.call('createTeacher', { schoolId: sid, teacher: { ...teacherInput('SCC002'), email: 'Old@Example.com' } });
    await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).update({ email: 'new@example.com' });
    await expect(link(sid, teacherId, user.uid, { matchEmail: 'old@example.com' })).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'invalid' } });
    expect((await teacherDoc(sid, teacherId)).uid).toBeUndefined();
    await link(sid, teacherId, user.uid, { matchEmail: 'new@example.com' });
    expect((await teacherDoc(sid, teacherId)).uid).toBe(user.uid);
  });

  it('fails for an unknown teacher', async () => {
    const { sid, user } = await setup();
    await expect(link(sid, 'nope', user.uid)).rejects.toMatchObject({ code: 'not-found', details: { code: 'invalid' } });
  });
});

describe('fileJoinRequest', () => {
  const file = (sid: string, teacherId: string, uid: string) => fileJoinRequest(sid, teacherId, { uid, email: 'x@example.com', staffId: 'SCC001' });
  const requestOf = async (sid: string, uid: string) => (await adminDb.doc(`${paths.joinRequests(sid)}/${uid}`).get()).data();

  it('writes a fresh pending request, dropping an earlier decision', async () => {
    const { sid, teacherId, user } = await setup();
    await adminDb.doc(`${paths.joinRequests(sid)}/${user.uid}`).set({ uid: user.uid, status: 'rejected', decidedAt: 1, createdAt: 1 });
    await file(sid, teacherId, user.uid);
    const doc = await requestOf(sid, user.uid);
    expect(doc).toMatchObject({ uid: user.uid, email: 'x@example.com', staffId: 'SCC001', teacherId, status: 'pending' });
    expect(doc!.decidedAt).toBeUndefined();
  });

  it('refuses a teacher deleted since the caller read it', async () => {
    const { sid, teacherId, user } = await setup();
    await adminDb.doc(`${paths.teachers(sid)}/${teacherId}`).delete();
    await expect(file(sid, teacherId, user.uid)).rejects.toMatchObject({ code: 'failed-precondition', message: 'This staff ID cannot be used to join', details: { code: 'staff-id-unknown' } });
    expect(await requestOf(sid, user.uid)).toBeUndefined();
  });

  it('refuses a teacher linked since the caller read it', async () => {
    const { sid, teacherId, user } = await setup();
    await link(sid, teacherId, (await signUp()).uid);
    const err = await file(sid, teacherId, user.uid).catch((e: { code?: string; message?: string; details?: unknown }) => e);
    expect(err).toMatchObject({ code: 'failed-precondition', message: 'This staff ID cannot be used to join' });
    expect((err as { details?: unknown }).details).toEqual({ code: 'staff-id-unknown' });
    expect(await requestOf(sid, user.uid)).toBeUndefined();
  });

  it('refuses an account that got a teacher in the school since the caller read it', async () => {
    const { admin, sid, teacherId, user } = await setup();
    const { teacherId: other } = await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC002') });
    await link(sid, other, user.uid);
    await expect(file(sid, teacherId, user.uid)).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'already-linked', reason: 'account' } });
    expect(await requestOf(sid, user.uid)).toBeUndefined();
  });
});
