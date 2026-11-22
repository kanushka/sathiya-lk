// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { appActionLink } from '../src/email/actionLink';

const APP = 'https://app.sathiya.kanushka.com';
const fb = (q: string) => `https://sathiya-lk.firebaseapp.com/__/auth/action?${q}`;

describe('appActionLink', () => {
  it('moves a verify link onto the app /auth/action page', () => {
    const link = appActionLink(fb('mode=verifyEmail&oobCode=abc123&apiKey=KEY&lang=en'), APP);
    expect(link).toBe(`${APP}/auth/action?mode=verifyEmail&oobCode=abc123&apiKey=KEY&lang=en`);
  });

  it('moves a reset link and keeps continueUrl', () => {
    const cont = `${APP}/login`;
    const link = appActionLink(fb(`mode=resetPassword&oobCode=xyz&apiKey=KEY&continueUrl=${encodeURIComponent(cont)}&lang=si`), APP);
    const u = new URL(link);
    expect(`${u.origin}${u.pathname}`).toBe(`${APP}/auth/action`);
    expect(Object.fromEntries(u.searchParams)).toEqual({ mode: 'resetPassword', oobCode: 'xyz', apiKey: 'KEY', lang: 'si', continueUrl: cont });
    expect(link).toContain(`continueUrl=${encodeURIComponent(cont)}`);
  });

  it('url-encodes values', () => {
    const link = appActionLink(fb(`mode=resetPassword&oobCode=${encodeURIComponent('a+b/c=&d')}&apiKey=K%20Y`), APP);
    expect(link).toBe(`${APP}/auth/action?mode=resetPassword&oobCode=a%2Bb%2Fc%3D%26d&apiKey=K%20Y`);
    expect(new URL(link).searchParams.get('oobCode')).toBe('a+b/c=&d');
  });

  it('drops params it does not know and omits missing ones', () => {
    expect(appActionLink(fb('mode=verifyEmail&oobCode=c&tenantId=t&evil=1'), APP)).toBe(`${APP}/auth/action?mode=verifyEmail&oobCode=c`);
  });

  it('works with the emulator link shape and a trailing-slash app url', () => {
    expect(appActionLink('http://127.0.0.1:9099/emulator/action?mode=verifyEmail&lang=en&oobCode=c&apiKey=fake', `${APP}/`)).toBe(
      `${APP}/auth/action?mode=verifyEmail&oobCode=c&apiKey=fake&lang=en`,
    );
  });

  it('throws when the generated link has no mode or oobCode', () => {
    expect(() => appActionLink(fb('apiKey=K'), APP)).toThrow();
  });
});
