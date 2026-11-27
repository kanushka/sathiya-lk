// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { syncPublishedName, syncSchoolDirectory } from '../src/syncDirectory';
import { adminDb, adminWithSchool, makeSuper, signUp } from './helpers';

async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 10_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await read();
    if (ok(v) || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
}

const dirDoc = (sid: string) => adminDb.doc(paths.directory(sid));
const readDir = async (sid: string) => (await dirDoc(sid).get()).data();

describe('school directory search fields + sync', () => {
  it('registerSchool writes nameLower and cityLower', async () => {
    const { sid } = await adminWithSchool();
    const dir = await readDir(sid);
    expect(dir).toMatchObject({ nameLower: 'siripura central college', cityLower: 'siripura' });
  });

  it('propagates nameEn, nameSi, city, district and type from the school doc', async () => {
    const { sid } = await adminWithSchool();
    await adminDb.doc(paths.school(sid)).update({ nameEn: '  Royal  College ', nameSi: 'රාජකීය', city: ' Colombo 07 ', district: 'Colombo', type: 'government' });
    const dir = await eventually(() => readDir(sid), (d) => d?.nameLower === 'royal  college');
    expect(dir).toEqual({
      nameEn: '  Royal  College ',
      nameSi: 'රාජකීය',
      district: 'Colombo',
      city: ' Colombo 07 ',
      type: 'government',
      status: 'active',
      nameLower: 'royal  college',
      cityLower: 'colombo 07',
    });
  });

  it('reflects status changes made through setSchoolStatus', async () => {
    const { sid } = await adminWithSchool();
    const sup = await signUp();
    await makeSuper(sup);
    await sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' });
    const dir = await eventually(() => readDir(sid), (d) => d?.status === 'disabled');
    expect(dir?.status).toBe('disabled');
    await adminDb.doc(paths.school(sid)).update({ status: 'active' });
    expect((await eventually(() => readDir(sid), (d) => d?.status === 'active'))?.status).toBe('active');
  });

  it('does not rewrite the directory doc when no directory field changed', async () => {
    const { sid } = await adminWithSchool();
    await adminDb.doc(paths.school(sid)).update({ nameEn: 'Marker One' });
    await eventually(() => readDir(sid), (d) => d?.nameEn === 'Marker One');
    const before = (await dirDoc(sid).get()).updateTime!;
    await adminDb.doc(paths.school(sid)).update({ phone: '0112345678' });
    await adminDb.doc(paths.school(sid)).update({ address: 'Somewhere' });
    await new Promise((r) => setTimeout(r, 2500));
    expect((await dirDoc(sid).get()).updateTime!.isEqual(before)).toBe(true);
  });

  it('deletes the directory doc when the school doc is deleted', async () => {
    const { sid } = await adminWithSchool();
    await adminDb.doc(paths.school(sid)).delete();
    const snap = await eventually(() => dirDoc(sid).get(), (s) => !s.exists);
    expect(snap.exists).toBe(false);
  });

  it('ignores event ordering: syncing by sid restores the school doc state over a stale directory', async () => {
    const { sid } = await adminWithSchool();
    await adminDb.doc(paths.school(sid)).update({ nameEn: 'Newest Name' });
    await eventually(() => readDir(sid), (d) => d?.nameEn === 'Newest Name');
    await dirDoc(sid).set({ nameEn: 'Stale Name', nameLower: 'stale name', cityLower: 'x', city: 'x', district: 'x', status: 'disabled' });
    await syncSchoolDirectory(sid);
    expect(await readDir(sid)).toMatchObject({ nameEn: 'Newest Name', nameLower: 'newest name', status: 'active', city: 'Siripura' });
  });

  it('removes a leftover directory doc when the school is gone', async () => {
    const { sid } = await adminWithSchool();
    await adminDb.doc(paths.school(sid)).delete();
    await eventually(() => dirDoc(sid).get(), (s) => !s.exists);
    await dirDoc(sid).set({ nameEn: 'Ghost' });
    await syncSchoolDirectory(sid);
    expect((await dirDoc(sid).get()).exists).toBe(false);
  });
});

describe('syncPublishedName', () => {
  const cls = (sid: string) => adminDb.doc(`${paths.publishedClasses(sid, 'y1')}/c1`);
  const tch = (sid: string) => adminDb.doc(`${paths.publishedTeachers(sid, 'y1')}/t1`);

  it('renames published snapshots to the school name and records it', async () => {
    const { sid } = await adminWithSchool();
    await adminDb.doc(`${paths.years(sid)}/y1`).set({ label: '2026', status: 'published' });
    await cls(sid).set({ classId: 'c1', schoolName: { nameEn: 'Old' } });
    await tch(sid).set({ teacherId: 't1', schoolName: { nameEn: 'Old' } });
    await adminDb.doc(paths.school(sid)).update({ nameEn: 'New Name', nameSi: 'නව නම', publishedName: { nameEn: 'Old' } });
    await syncPublishedName(sid);
    const want = { nameEn: 'New Name', nameSi: 'නව නම' };
    expect((await cls(sid).get()).get('schoolName')).toEqual(want);
    expect((await tch(sid).get()).get('schoolName')).toEqual(want);
    expect((await adminDb.doc(paths.school(sid)).get()).get('publishedName')).toEqual(want);
  });

  it('does nothing once the recorded name matches', async () => {
    const { sid } = await adminWithSchool();
    await adminDb.doc(`${paths.years(sid)}/y1`).set({ label: '2026', status: 'published' });
    await expect.poll(async () => (await adminDb.doc(paths.school(sid)).get()).get('publishedName'), { timeout: 10_000 }).toBeDefined();
    await cls(sid).set({ classId: 'c1', schoolName: { nameEn: 'Untouched' } });
    await syncPublishedName(sid);
    expect((await cls(sid).get()).get('schoolName')).toEqual({ nameEn: 'Untouched' });
  });
});
