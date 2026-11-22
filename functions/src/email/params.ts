// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { defineString } from 'firebase-functions/params';

// Override per project in functions/.env.<project>. functions/.env holds the same defaults so the CLI doesn't prompt for them.
// `.value()` is empty when the code runs outside a deployed/emulated function (unit tests), so the defaults are applied here too.
const DEFAULTS = {
  MAIL_FROM: 'Sathiya <noreply@sathiya.kanushka.com>',
  MAIL_REPLY_TO: 'sathiya@kanushka.com',
  APP_URL: 'https://app.sathiya.kanushka.com',
  WEB_URL: 'https://sathiya.kanushka.com',
  // Comma-separated super admin addresses that receive report emails; empty = no report emails.
  SUPER_EMAILS: '',
  // Prepended (plus a space) to every mail subject; set to "[staging]" outside production.
  MAIL_SUBJECT_PREFIX: '',
};
const param = (name: keyof typeof DEFAULTS) => defineString(name, { default: DEFAULTS[name] });
const MAIL_FROM = param('MAIL_FROM');
const MAIL_REPLY_TO = param('MAIL_REPLY_TO');
const APP_URL = param('APP_URL');
const WEB_URL = param('WEB_URL');
const SUPER_EMAILS = param('SUPER_EMAILS');
const MAIL_SUBJECT_PREFIX = param('MAIL_SUBJECT_PREFIX');
const val = (p: ReturnType<typeof param>, name: keyof typeof DEFAULTS): string => (name in process.env ? p.value() : DEFAULTS[name]);

const trimUrl = (u: string): string => u.trim().replace(/\/+$/, '');

export interface MailConfig {
  from: string;
  replyTo: string;
  appUrl: string;
  webUrl: string;
  superEmails: string[];
  subjectPrefix: string;
}

export function mailConfig(): MailConfig {
  return {
    from: val(MAIL_FROM, 'MAIL_FROM').trim(),
    replyTo: val(MAIL_REPLY_TO, 'MAIL_REPLY_TO').trim(),
    appUrl: trimUrl(val(APP_URL, 'APP_URL')),
    webUrl: trimUrl(val(WEB_URL, 'WEB_URL')),
    superEmails: [...new Set(val(SUPER_EMAILS, 'SUPER_EMAILS').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean))],
    subjectPrefix: val(MAIL_SUBJECT_PREFIX, 'MAIL_SUBJECT_PREFIX').trim(),
  };
}

// Idempotent, so a subject that writeMail already prefixed is not prefixed twice when sent.
export function withSubjectPrefix(subject: string, prefix: string): string {
  return prefix && !subject.startsWith(`${prefix} `) ? `${prefix} ${subject}` : subject;
}
