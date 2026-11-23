// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { createHash } from 'node:crypto';
import { logger } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';
import { auth } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { AUTH_EMAIL_KINDS, type AuthEmailKind, type SendAuthEmailRes } from '@sathiya/core';
import { email, fail, invalid, obj, requireAuth } from './lib/guards';
import {
  clearRateLimit,
  clientIp,
  consumeRateLimits,
  hashIp,
  RESET_PER_EMAIL_PER_DAY,
  RESET_PER_IP_PER_DAY,
  VERIFY_PER_IP_PER_DAY,
  VERIFY_PER_UID_PER_DAY,
} from './lib/rateLimit';
import { mailConfig } from './email/params';
import { appActionLink } from './email/actionLink';
import { writeMail } from './email/send';
import { passwordReset, verifyEmail } from './email/templates';

// Teacher login addresses (core syntheticEmail) are not real mailboxes.
const isTeacherLogin = (e: string): boolean => e.endsWith('.teachers.sathiya.lk');

const hash = (v: string): string => createHash('sha256').update(v).digest('hex');

type AuthErr = { code?: string; message?: string };
const authText = (e: AuthErr): string => `${e.message ?? ''} ${String((e as { cause?: unknown }).cause ?? '')}`;

// With email enumeration protection on, Auth answers an unknown address with no link instead of user-not-found.
const noAccount = (e: AuthErr): boolean =>
  ['auth/user-not-found', 'auth/email-not-found'].includes(e.code ?? '') ||
  (e.code === 'auth/internal-error' && authText(e).includes('Unable to create the email action link'));

const throttledByAuth = (e: AuthErr): boolean => authText(e).includes('TOO_MANY_ATTEMPTS_TRY_LATER');

const linkOrThrottle = (p: Promise<string>): Promise<string> =>
  p.catch((e: AuthErr) => (throttledByAuth(e) ? fail('resource-exhausted', 'rate-limited', 'Too many attempts, try again later') : Promise.reject(e)));

// verify: the signed-in user's own address. reset: open to signed-out callers and always answers ok, so it can't be used
// to find out which addresses have an account.
export const sendAuthEmail = onCall(callOpts, async (req): Promise<SendAuthEmailRes> => {
  const data = obj(req.data, 'request');
  const kind = data.kind as AuthEmailKind;
  if (!AUTH_EMAIL_KINDS.includes(kind)) invalid(`kind must be one of ${AUTH_EMAIL_KINDS.join(', ')}`);
  if (data.lang !== 'en' && data.lang !== 'si') invalid('lang must be en or si');
  const lang = data.lang as 'en' | 'si';
  const { appUrl, webUrl } = mailConfig();
  const actionCodeSettings = { url: `${appUrl}/login` };

  if (kind === 'verify') {
    const { uid, token } = requireAuth(req);
    await consumeRateLimits([
      { scope: 'verify-uid', id: uid, max: VERIFY_PER_UID_PER_DAY },
      { scope: 'verify-ip', id: hashIp(clientIp(req)), max: VERIFY_PER_IP_PER_DAY },
    ]);
    const to = token.email;
    if (!to) invalid('Account has no email address');
    // Reset requests made before this account existed sent nothing, so they shouldn't block its first reset.
    await clearRateLimit('reset-email', hash(to!.toLowerCase()));
    if (token.email_verified === true) return { ok: true };
    const link = appActionLink(await linkOrThrottle(auth.generateEmailVerificationLink(to!, actionCodeSettings)), appUrl);
    await writeMail({ to: [to!], message: verifyEmail({ link, lang, webUrl }) });
    return { ok: true };
  }

  const to = email(data.email);
  await consumeRateLimits([
    { scope: 'reset-ip', id: hashIp(clientIp(req)), max: RESET_PER_IP_PER_DAY },
    { scope: 'reset-email', id: hash(to), max: RESET_PER_EMAIL_PER_DAY },
  ]);
  if (isTeacherLogin(to)) return { ok: true };
  try {
    const link = appActionLink(await auth.generatePasswordResetLink(to, actionCodeSettings), appUrl);
    await writeMail({ to: [to], message: passwordReset({ link, lang, webUrl }) });
  } catch (e) {
    if (!noAccount(e as AuthErr)) logger.error('password reset email not sent', e);
  }
  return { ok: true };
});
