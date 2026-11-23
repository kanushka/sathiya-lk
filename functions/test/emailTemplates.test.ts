// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import {
  adminInvite,
  passwordReset,
  reportReceived,
  schoolReactivated,
  schoolRegistered,
  schoolSuspended,
  verifyEmail,
} from '../src/email/templates';

const school = { nameEn: 'Siripura Central College', nameSi: 'සිරිපුර මධ්‍ය මහා විද්‍යාලය', colors: { primary: '#7A1F3D' } };
const loginUrl = 'https://app.example.test/login';
const webUrl = 'https://www.example.test';

const cases = {
  adminInvite: () => adminInvite({ inviter: 'W. Perera', school, loginUrl, webUrl }),
  schoolRegistered: () => schoolRegistered({ adminName: 'W. Perera', school, loginUrl, webUrl }),
  reportReceived: () =>
    reportReceived({ schoolName: school.nameEn, schoolId: 'abc123', reason: 'fake', details: 'No such school.\nCalled them.', reporterEmail: 'parent@example.com', loginUrl, webUrl }),
  schoolSuspended: () => schoolSuspended({ school, loginUrl, webUrl }),
  schoolReactivated: () => schoolReactivated({ school, loginUrl, webUrl }),
  verifyEmail: () => verifyEmail({ link: 'https://app.example.test/auth/action?mode=verifyEmail&oobCode=abc', lang: 'en', webUrl }),
  passwordReset: () => passwordReset({ link: 'https://app.example.test/auth/action?mode=resetPassword&oobCode=abc', lang: 'si', webUrl }),
};

describe('email templates', () => {
  for (const [name, make] of Object.entries(cases)) {
    it(`${name} snapshot`, () => {
      const { subject, html, text } = make();
      expect({ subject, html, text }).toMatchSnapshot();
    });

    it(`${name} is bilingual, English first, with a plain-text twin`, () => {
      const { html, text } = make();
      expect(html.indexOf('Hello')).toBeGreaterThan(-1);
      expect(html.indexOf('ආයුබෝවන්')).toBeGreaterThan(html.indexOf('Hello'));
      expect(text.indexOf('ආයුබෝවන්')).toBeGreaterThan(text.indexOf('Hello'));
      expect(html).not.toMatch(/<script|<style|<svg|display:flex/);
    });
  }

  it('uses the school colours with a readable foreground, else Sathiya teal', () => {
    expect(cases.adminInvite().html).toContain('background:#7A1F3D;color:#FFFFFF');
    expect(cases.verifyEmail().html).toContain('background:#0E6B6A;color:#FFFFFF');
    const light = adminInvite({ inviter: 'A', school: { nameEn: 'S', colors: { primary: '#FFEE00' } }, loginUrl });
    expect(light.html).toContain('background:#FFEE00;color:#14213D');
    const bad = adminInvite({ inviter: 'A', school: { nameEn: 'S', colors: { primary: 'red;x:y' } }, loginUrl });
    expect(bad.html).toContain('background:#0E6B6A');
    expect(bad.html).not.toContain('red;x:y');
  });

  it('subjects: invite and verify match the design; verify subject order follows lang', () => {
    expect(cases.adminInvite().subject).toBe("You're invited to manage Siripura Central College on Sathiya");
    expect(cases.verifyEmail().subject).toBe('Confirm your email for Sathiya · ඔබගේ ඊමේල් තහවුරු කරන්න');
    expect(verifyEmail({ link: loginUrl, lang: 'si' }).subject).toBe('ඔබගේ ඊමේල් තහවුරු කරන්න · Confirm your email for Sathiya');
  });

  it('escapes every interpolated value and URL attribute', () => {
    const evil = '<script>alert("x")</script> & O\'Brien';
    const withNewline = adminInvite({ inviter: 'A', school: { nameEn: 'S\r\nBcc: x@y.z' }, loginUrl });
    expect(withNewline.subject).not.toMatch(/[\r\n]/);
    const escaped = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; O&#39;Brien';
    const url = 'https://app.example.test/login?a=1&b="><script>alert(1)</script>';
    const out = [
      adminInvite({ inviter: evil, school: { nameEn: evil, nameSi: evil, logoUrl: url, colors: { primary: '#7A1F3D' } }, loginUrl: url, webUrl: url }),
      schoolRegistered({ adminName: evil, school: { nameEn: evil }, loginUrl: url, webUrl: url }),
      reportReceived({ schoolName: evil, schoolId: evil, reason: evil, details: evil, reporterEmail: evil, loginUrl: url, webUrl: url }),
      schoolSuspended({ school: { nameEn: evil, nameSi: evil }, loginUrl: url }),
      schoolReactivated({ school: { nameEn: evil, nameSi: evil }, loginUrl: url }),
      verifyEmail({ link: url, webUrl: url }),
    ];
    for (const { html, subject } of out) {
      expect(html).not.toContain('<script');
      expect(html).not.toContain(evil);
      if (html.includes('href=')) expect(html).toContain('a=1&amp;b=%22%3E%3Cscript%3Ealert(1)%3C/script%3E');
      expect(html).toContain('&lt;script&gt;');
      expect(subject).not.toMatch(/[\r\n]/);
    }
    expect(out[0]!.html).toContain(escaped);
    expect(out[2]!.html).toContain(escaped);
  });

  it('drops non-http(s) URLs', () => {
    const { html, text } = adminInvite({ inviter: 'A', school: { nameEn: 'S', logoUrl: 'javascript:alert(1)' }, loginUrl: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(text).not.toContain('javascript:');
    expect(html).not.toContain('<img');
  });
});

describe('email templates for a school with only a Sinhala name', () => {
  it('uses the Sinhala name in the subject, header and body', () => {
    const siOnly = { nameEn: '', nameSi: 'සිරිපුර විද්‍යාලය', colors: { primary: '#7A1F3D' } };
    const r = schoolRegistered({ adminName: 'W. Perera', school: siOnly, loginUrl, webUrl });
    expect(r.subject).toBe('Welcome to Sathiya: සිරිපුර විද්‍යාලය is registered');
    expect(r.text).toContain('සිරිපුර විද්‍යාලය is now registered');
    expect(adminInvite({ inviter: 'W. Perera', school: siOnly, loginUrl, webUrl }).subject).toContain('සිරිපුර විද්‍යාලය');
  });
});
