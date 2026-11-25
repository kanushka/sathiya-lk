// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { as, initEnv, type Role } from './setup';

let env: RulesTestEnvironment;
const MB = 1024 * 1024;
const PNG = 'image/png';
const JPEG = 'image/jpeg';
const WEBP = 'image/webp';
const SVG = 'image/svg+xml';

beforeAll(async () => {
  env = await initEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = ctx.storage();
    await s.ref('schools/s1/logo.png').put(new Uint8Array(10), { contentType: PNG });
    await s.ref('schools/s1/private.png').put(new Uint8Array(10), { contentType: PNG });
    await s.ref('schools/s1/logo.svg').put(new Uint8Array(10), { contentType: SVG });
  });
});

const upload = (r: Role, path: string, size: number, contentType: string) =>
  as(env, r).storage().ref(path).put(new Uint8Array(size), { contentType }).then((s) => s);
const meta = (r: Role, path: string) => as(env, r).storage().ref(path).getMetadata();
const remove = (r: Role, path: string) => as(env, r).storage().ref(path).delete();

describe('logo read', () => {
  it.each<Role>(['anon', 'noClaims', 'teacher', 'otherAdmin'])('is public (%s)', async (r) => {
    await assertSucceeds(meta(r, 'schools/s1/logo.png'));
  });
  it('an existing SVG logo stays public', async () => {
    await assertSucceeds(meta('anon', 'schools/s1/logo.svg'));
  });
  it('other files under the school are not readable', async () => {
    await assertFails(meta('anon', 'schools/s1/private.png'));
    await assertFails(meta('admin', 'schools/s1/private.png'));
  });
});

describe('logo write', () => {
  it('allows admin of sid to upload png, jpeg and webp up to 1 MB', async () => {
    await assertSucceeds(upload('admin', 'schools/s1/logo.png', 1000, PNG));
    await assertSucceeds(upload('admin', 'schools/s1/logo.jpg', 1000, JPEG));
    await assertSucceeds(upload('admin', 'schools/s1/logo.webp', 1000, WEBP));
    await assertSucceeds(upload('adminTid', 'schools/s1/logo.png', MB, PNG));
  });
  it('denies svg uploads, including over an existing svg logo', async () => {
    await assertFails(upload('admin', 'schools/s1/logo.svg', 1000, SVG));
    await assertFails(upload('admin', 'schools/s1/logo.png', 1000, SVG));
    await assertFails(upload('admin', 'schools/s1/logo.svg', 1000, PNG));
  });
  it('denies files over 1 MB', async () => {
    await assertFails(upload('admin', 'schools/s1/logo.png', MB + 1, PNG));
  });
  it('denies other content types', async () => {
    await assertFails(upload('admin', 'schools/s1/logo.png', 1000, 'image/gif'));
    await assertFails(upload('admin', 'schools/s1/logo.png', 1000, 'text/html'));
    await assertFails(upload('admin', 'schools/s1/logo.png', 1000, 'image/png; charset=utf-8'));
    await assertFails(upload('admin', 'schools/s1/logo.png', 1000, 'image/svg+xml; charset=utf-8'));
  });
  it('denies other file names', async () => {
    await assertFails(upload('admin', 'schools/s1/banner.png', 1000, PNG));
    await assertFails(upload('admin', 'schools/s1/sub/logo.png', 1000, PNG));
    await assertFails(upload('admin', 'schools/s1/logo', 1000, PNG));
    await assertFails(upload('admin', 'schools/s1/logo.html', 1000, PNG));
    await assertFails(upload('admin', 'schools/s1/logo.jpeg', 1000, JPEG));
    await assertFails(upload('admin', 'other/logo.png', 1000, PNG));
  });
  it.each<Role>(['teacher', 'super', 'otherAdmin', 'noClaims', 'anon'])('denies %s', async (r) => {
    await assertFails(upload(r, 'schools/s1/logo.png', 1000, PNG));
  });
  it('admin of another school or teacher-only claim cannot upload', async () => {
    await assertFails(upload('adminS1TeacherS2', 'schools/s2/logo.png', 1000, PNG));
    await assertFails(upload('multiTeacher', 'schools/s1/logo.png', 1000, PNG));
    await assertSucceeds(upload('adminS1TeacherS2', 'schools/s1/logo.png', 1000, PNG));
  });
  it('allows admin of sid to delete the logo, nobody else', async () => {
    await assertFails(remove('teacher', 'schools/s1/logo.png'));
    await assertFails(remove('otherAdmin', 'schools/s1/logo.png'));
    await assertFails(remove('super', 'schools/s1/logo.png'));
    await assertSucceeds(remove('admin', 'schools/s1/logo.png'));
  });
  it('allows admin of sid to delete an existing svg logo', async () => {
    await assertFails(remove('otherAdmin', 'schools/s1/logo.svg'));
    await assertSucceeds(remove('admin', 'schools/s1/logo.svg'));
  });
});
