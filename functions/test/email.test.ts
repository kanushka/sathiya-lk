// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { logger } from 'firebase-functions/v2';
import { httpsCallable } from 'firebase/functions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/admin';
import { hashIp, INVITE_PER_SCHOOL_PER_DAY, INVITE_PER_UID_PER_DAY, RESET_PER_EMAIL_PER_DAY, VERIFY_PER_IP_PER_DAY, VERIFY_PER_UID_PER_DAY } from '../src/lib/rateLimit';
import { setSchoolStatus } from '../src/setSchoolStatus';
import { sendMail, writeMail } from '../src/email/send';
import { adminAuth, adminDb, adminWithSchool, client, expectFnError, makeSuper, rawCall, rawErr, schoolReq, signUp, teacherInput, uniq, unverifiedSignUp, type Client } from './helpers';

const APP_URL = 'https://app.sathiya.kanushka.com';
const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const actionHref = (mode: string) =>
  new RegExp(`href="${esc(APP_URL)}/auth/action\\?mode=${mode}&amp;oobCode=[^"&]+&amp;apiKey=[^"&]+&amp;lang=en&amp;continueUrl=${esc(encodeURIComponent(`${APP_URL}/login`))}"`);
const FROM = 'Sathiya <noreply@sathiya.kanushka.com>';
const REPLY_TO = 'sathiya@kanushka.com';

const mailsTo = async (to: string) => (await adminDb.collection('mail').where('to', 'array-contains', to.toLowerCase()).get()).docs.map((d) => d.data());
const emailOf = (c: Client) => c.auth.currentUser!.email!;
const sendAuth = async (c: Client, req: unknown) => (await httpsCallable(c.functions, 'sendAuthEmail')(req)).data;

afterEach(() => vi.restoreAllMocks());

describe('app emails', () => {
  it('registerSchool mails the founding admin', async () => {
    const admin = await signUp();
    await admin.call('registerSchool', schoolReq());
    const mails = await mailsTo(emailOf(admin));
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: [emailOf(admin)], from: FROM, replyTo: REPLY_TO });
    expect(mails[0]!.message.subject).toBe('Welcome to Sathiya: Siripura Central College is registered');
    expect(mails[0]!.message.html).toContain(`href="${APP_URL}/login`);
    expect(mails[0]!.message.text).toContain('Principal');
  });

  it('inviteAdmin mails the invitee with the inviter as reply-to', async () => {
    const { admin, sid } = await adminWithSchool();
    const invitee = `new-${uniq()}@Example.com`;
    await admin.call('inviteAdmin', { schoolId: sid, email: invitee });
    const mails = await mailsTo(invitee);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: [invitee.toLowerCase()], replyTo: emailOf(admin), from: FROM });
    expect(mails[0]!.message.subject).toBe("You're invited to manage Siripura Central College on Sathiya");
    expect(mails[0]!.message.html).toContain('<b>Principal</b>');
    expect(mails[0]!.message.html).toContain(`${APP_URL}/login`);
  });

  it('inviteAdmin is limited per admin and per school, before the invite is written', async () => {
    const { admin, sid } = await adminWithSchool();
    for (let i = 0; i < INVITE_PER_UID_PER_DAY; i++) await admin.call('inviteAdmin', { schoolId: sid, email: `inv-${i}-${uniq()}@example.com` });
    const blocked = `blocked-${uniq()}@example.com`;
    await expectFnError(admin.call('inviteAdmin', { schoolId: sid, email: blocked }), 'resource-exhausted', 'rate-limited');
    expect((await adminDb.doc(`${paths.invites(sid)}/${blocked}`).get()).exists).toBe(false);
    expect(await mailsTo(blocked)).toHaveLength(0);
  });

  it('inviteAdmin has a per-school daily limit shared by all its admins', async () => {
    const { admin, sid } = await adminWithSchool();
    const day = new Date().toISOString().slice(0, 10);
    await adminDb.doc(`rateLimits/invite-school_${day}_${sid}`).set({ scope: 'invite-school', day, count: INVITE_PER_SCHOOL_PER_DAY });
    const to = `blocked-${uniq()}@example.com`;
    await expectFnError(admin.call('inviteAdmin', { schoolId: sid, email: to }), 'resource-exhausted', 'rate-limited');
    expect((await adminDb.doc(`${paths.invites(sid)}/${to}`).get()).exists).toBe(false);
  });

  it('reportSchool mails the configured super admins', async () => {
    const { reportSchool } = await import('../src/reportSchool');
    const { sid } = await adminWithSchool();
    vi.stubEnv('SUPER_EMAILS', 'super-one@example.test, Super-Two@example.test');
    await reportSchool.run({ data: { schoolId: sid, reason: 'fake', details: 'Looks <fake>' }, rawRequest: { headers: {} } } as never);
    vi.unstubAllEnvs();
    const mails = (await mailsTo('super-one@example.test')).filter((m) => m.message.html.includes(sid));
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: ['super-one@example.test', 'super-two@example.test'], from: FROM });
    expect(mails[0]!.message.subject).toBe('New report (Fake school): Siripura Central College');
    expect(mails[0]!.message.html).toContain('Looks &lt;fake&gt;');
  });

  it('reportSchool sends nothing when no super emails are configured', async () => {
    const { reportSchool } = await import('../src/reportSchool');
    const { sid } = await adminWithSchool();
    vi.stubEnv('SUPER_EMAILS', '');
    const before = (await adminDb.collection('mail').get()).size;
    await reportSchool.run({ data: { schoolId: sid, reason: 'other' }, rawRequest: { headers: {} } } as never);
    vi.unstubAllEnvs();
    expect((await adminDb.collection('reports').where('schoolId', '==', sid).get()).size).toBe(1);
    expect((await adminDb.collection('mail').get()).size).toBe(before);
  });

  it('setSchoolStatus mails the school admins on suspend and reactivate, and only on a change', async () => {
    const { admin, sid } = await adminWithSchool();
    const other = `co-${uniq()}@example.com`;
    await adminDb.doc(`${paths.members(sid)}/co-admin`).set({ uid: 'co-admin', role: 'admin', email: other });
    await adminDb.doc(`${paths.members(sid)}/t1`).set({ uid: 't1', role: 'teacher', email: `t-${uniq()}@example.com` });
    const sup = await signUp();
    await makeSuper(sup);
    const base = (await mailsTo(emailOf(admin))).length;

    await sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' });
    await sup.call('setSchoolStatus', { schoolId: sid, status: 'disabled' });
    let mails = await mailsTo(emailOf(admin));
    expect(mails).toHaveLength(base + 1);
    expect(mails.some((m) => m.message.subject === 'Siripura Central College has been suspended on Sathiya')).toBe(true);
    expect(await mailsTo(other)).toHaveLength(1);

    await sup.call('setSchoolStatus', { schoolId: sid, status: 'active' });
    mails = await mailsTo(emailOf(admin));
    expect(mails.some((m) => m.message.subject === 'Siripura Central College is active again on Sathiya')).toBe(true);
    expect(await mailsTo(other)).toHaveLength(2);
    const all = (await adminDb.collection('mail').get()).docs.map((d) => d.data());
    expect(all.some((m) => (m.to as string[]).some((t) => t.startsWith('t-')))).toBe(false);
  });

  it('teacher creation writes no mail', async () => {
    const { admin, sid } = await adminWithSchool();
    const before = (await adminDb.collection('mail').get()).size;
    await admin.call('createTeacher', { schoolId: sid, teacher: teacherInput('SCC031') });
    expect((await adminDb.collection('mail').get()).size).toBe(before);
  });

  it('a mail failure does not fail the callable', async () => {
    const { sid } = await adminWithSchool();
    const sup = await signUp();
    await makeSuper(sup);
    const orig = db.collection.bind(db);
    vi.spyOn(db, 'collection').mockImplementation(((p: string) =>
      p === 'mail' ? { add: () => Promise.reject(new Error('mail down')) } : orig(p)) as never);
    const err = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const claims = { uid: sup.uid, token: { super: true } };
    await expect(setSchoolStatus.run({ data: { schoolId: sid, status: 'disabled' }, auth: claims } as never)).resolves.toEqual({ ok: true });
    expect(err).toHaveBeenCalled();
    vi.restoreAllMocks();
    expect((await adminDb.doc(paths.school(sid)).get()).get('status')).toBe('disabled');
  });

  it('prefixes every subject with MAIL_SUBJECT_PREFIX when set and leaves it alone when empty', async () => {
    const to = `prefix-${uniq()}@example.com`;
    const message = { subject: 'Hello', html: '<p>x</p>', text: 'x' };
    await writeMail({ to: [to], message });
    vi.stubEnv('MAIL_SUBJECT_PREFIX', '[staging]');
    await writeMail({ to: [to], message });
    vi.stubEnv('MAIL_SUBJECT_PREFIX', '');
    await writeMail({ to: [to], message });
    vi.unstubAllEnvs();
    const subjects = (await mailsTo(to)).map((m) => m.message.subject).sort();
    expect(subjects).toEqual(['Hello', 'Hello', '[staging] Hello']);
  });

  it('sendMail swallows builder and write errors', async () => {
    const err = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    await expect(sendMail('x', async () => Promise.reject(new Error('boom')))).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledTimes(1);
  });
});

describe('sendAuthEmail', () => {
  it('verify mails the signed-in user a verification link', async () => {
    const c = await unverifiedSignUp();
    await expect(sendAuth(c, { kind: 'verify', lang: 'si' })).resolves.toEqual({ ok: true });
    const mails = await mailsTo(emailOf(c));
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: [emailOf(c)], from: FROM });
    expect(mails[0]!.message.subject).toBe('ඔබගේ ඊමේල් තහවුරු කරන්න · Confirm your email for Sathiya');
    expect(mails[0]!.message.html).toMatch(actionHref('verifyEmail'));
    expect(mails[0]!.message.text).toMatch(new RegExp(`Confirm email: ${esc(APP_URL)}/auth/action\\?mode=verifyEmail&oobCode=\\S+`));
  });

  it('verify refuses signed-out callers, is a no-op for verified users and is rate limited', async () => {
    await expectFnError(sendAuth(client(), { kind: 'verify', lang: 'en' }) as Promise<never>, 'unauthenticated', 'not-allowed');
    const verified = await signUp();
    await sendAuth(verified, { kind: 'verify', lang: 'en' });
    expect(await mailsTo(emailOf(verified))).toHaveLength(0);
    const c = await unverifiedSignUp();
    for (let i = 0; i < VERIFY_PER_UID_PER_DAY; i++) await sendAuth(c, { kind: 'verify', lang: 'en' });
    await expectFnError(sendAuth(c, { kind: 'verify', lang: 'en' }) as Promise<never>, 'resource-exhausted', 'rate-limited');
  });

  it('reset answers ok for known and unknown addresses but only mails the known one', async () => {
    const known = await signUp();
    const unknown = `ghost-${uniq()}@example.com`;
    const anon = client();
    await expect(sendAuth(anon, { kind: 'reset', email: emailOf(known).toUpperCase(), lang: 'en' })).resolves.toEqual({ ok: true });
    await expect(sendAuth(anon, { kind: 'reset', email: unknown, lang: 'en' })).resolves.toEqual({ ok: true });
    const mails = await mailsTo(emailOf(known));
    expect(mails).toHaveLength(1);
    expect(mails[0]!.message.subject).toBe('Reset your Sathiya password · ඔබගේ මුරපදය යළි සකසන්න');
    expect(mails[0]!.message.html).toMatch(actionHref('resetPassword'));
    expect(await mailsTo(unknown)).toHaveLength(0);
  });

  it('reset for a teacher login address answers ok and sends nothing', async () => {
    const to = `t${uniq()}@sid1.teachers.sathiya.lk`;
    await adminAuth.createUser({ email: to, password: 'secret123' });
    await expect(sendAuth(client(), { kind: 'reset', email: to, lang: 'en' })).resolves.toEqual({ ok: true });
    expect(await mailsTo(to)).toHaveLength(0);
  });

  it('verify is limited per IP', async () => {
    const c = await unverifiedSignUp();
    const day = new Date().toISOString().slice(0, 10);
    await adminDb.doc(`rateLimits/verify-ip_${day}_${hashIp('9.9.9.9')}`).set({ scope: 'verify-ip', day, count: VERIFY_PER_IP_PER_DAY });
    expect(rawErr(await rawCall('sendAuthEmail', { kind: 'verify', lang: 'en' }, { ip: '9.9.9.9', client: c }))).toEqual({ status: 'RESOURCE_EXHAUSTED', code: 'rate-limited' });
    expect(await mailsTo(emailOf(c))).toHaveLength(0);
  });

  it('verify clears reset requests made before the account existed', async () => {
    const c = await unverifiedSignUp();
    const to = emailOf(c);
    const anon = client();
    for (let i = 0; i < RESET_PER_EMAIL_PER_DAY; i++) await sendAuth(anon, { kind: 'reset', email: to, lang: 'en' });
    await sendAuth(c, { kind: 'verify', lang: 'en' });
    await expect(sendAuth(anon, { kind: 'reset', email: to, lang: 'en' })).resolves.toEqual({ ok: true });
  });

  it('reset is rate limited per email, also for unknown addresses', async () => {
    const anon = client();
    const to = `ghost-${uniq()}@example.com`;
    for (let i = 0; i < RESET_PER_EMAIL_PER_DAY; i++) await sendAuth(anon, { kind: 'reset', email: to, lang: 'en' });
    await expectFnError(sendAuth(anon, { kind: 'reset', email: to, lang: 'en' }) as Promise<never>, 'resource-exhausted', 'rate-limited');
  });

  it('validates input', async () => {
    const c = await signUp();
    await expectFnError(sendAuth(c, { kind: 'nope', lang: 'en' }) as Promise<never>, 'invalid-argument', 'invalid');
    await expectFnError(sendAuth(c, { kind: 'verify', lang: 'fr' }) as Promise<never>, 'invalid-argument', 'invalid');
    await expectFnError(sendAuth(client(), { kind: 'reset', email: 'not-an-email', lang: 'en' }) as Promise<never>, 'invalid-argument', 'invalid');
    await expectFnError(sendAuth(client(), { kind: 'reset', lang: 'en' }) as Promise<never>, 'invalid-argument', 'invalid');
  });
});
