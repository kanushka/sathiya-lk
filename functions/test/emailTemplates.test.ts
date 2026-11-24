// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import {
  adminInvite,
  passwordReset,
  reliefAssigned,
  reliefCancelled,
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

    it(`${name} is bilingual with a plain-text twin, and email-safe`, () => {
      const { html, text } = make();
      expect(html).toMatch(/<h1 [^>]*>/);
      expect(html).toMatch(/<h2 [^>]*>/);
      expect(html).toMatch(/[\u0D80-\u0DFF]/);
      expect(text).toMatch(/[\u0D80-\u0DFF]/);
      expect(html).not.toMatch(/<script|<style|<svg|display:flex|color-mix/);
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

  it('subjects end with the brand name; auth subjects follow lang', () => {
    expect(cases.adminInvite().subject).toBe('Join Siripura Central College on Sathiya (සතිය)');
    expect(cases.verifyEmail().subject).toBe('Confirm your email · Sathiya (සතිය)');
    expect(verifyEmail({ link: loginUrl, lang: 'si' }).subject).toBe('ඔබගේ ඊමේල් තහවුරු කරන්න · Sathiya (සතිය)');
    expect(cases.passwordReset().subject).toBe('ඔබගේ මුරපදය යළි සකසන්න · Sathiya (සතිය)');
    for (const make of Object.values(cases)) expect(make().subject).toContain('Sathiya (සතිය)');
  });

  it('puts the recipient language first, with the button', () => {
    const en = cases.verifyEmail();
    expect(en.html.indexOf('Confirm your email')).toBeLessThan(en.html.indexOf('ඔබගේ ඊමේල් තහවුරු කරන්න'));
    expect(en.html).toContain('>Confirm email</a>');
    expect(en.html).not.toContain('>ඊමේල් තහවුරු කරන්න</a>');
    const si = cases.passwordReset();
    expect(si.html).toContain('<html lang="si">');
    expect(si.html.indexOf('ඔබගේ මුරපදය යළි සකසන්න')).toBeLessThan(si.html.indexOf('Reset your password'));
    expect(si.html).toContain('>මුරපදය යළි සකසන්න</a>');
    expect(si.html).toContain('පහත බොත්තම');
    expect(si.text.indexOf('ඔබගේ මුරපදය')).toBeLessThan(si.text.indexOf('Reset your password'));
  });

  it('shows a pasteable link under auth buttons only', () => {
    expect(cases.verifyEmail().html).toContain('Button not working? Paste this link into your browser:');
    expect(cases.adminInvite().html).not.toContain('Paste this link');
  });

  it('school button and step numbers use the school colour', () => {
    expect(cases.adminInvite().html).toMatch(/<td style="background:#7A1F3D;border-radius:8px"><a href="https:\/\/app\.example\.test\/login" style="display:inline-block;padding:12px 20px;color:#FFFFFF/);
    expect(cases.schoolRegistered().html).toContain('background:#7A1F3D;color:#FFFFFF;text-align:center');
  });

  it('school header stacks the Sinhala name only when both names exist', () => {
    expect(cases.adminInvite().html).toContain('සිරිපුර මධ්‍ය මහා විද්‍යාලය</span></span>');
    const enOnly = adminInvite({ inviter: 'A', school: { nameEn: 'S' }, loginUrl });
    expect(enOnly.html).not.toContain('<br><span style="font-family:');
  });

  it('report and status emails carry facts, badges and status strips', () => {
    const r = cases.reportReceived();
    expect(r.html).toContain('Super admin');
    expect(r.html).toContain('#FDF0D8');
    expect(r.text).toContain('Reason: Fake school');
    expect(r.text).toContain('Reporter: parent@example.com');
    expect(cases.schoolSuspended().html).toContain('Suspended');
    expect(cases.schoolSuspended().html).toContain('#FBEAEA');
    expect(cases.schoolReactivated().text).toContain('[Active] Admins and teachers can sign in again.');
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
    expect(r.subject).toBe('සිරිපුර විද්‍යාලය is registered · Sathiya (සතිය)');
    expect(r.text).toContain('සිරිපුර විද්‍යාලය is registered on Sathiya');
    expect(r.html).not.toContain('<br><span style="font-family:');
    expect(adminInvite({ inviter: 'W. Perera', school: siOnly, loginUrl, webUrl }).subject).toContain('සිරිපුර විද්‍යාලය');
  });
});

describe('relief email templates', () => {
  const todayUrl = 'https://app.example.test/s/abc/me';
  const row = { period: 3, start: '09:15', end: '10:00', className: '6B', subject: 'Maths', forTeacher: 'Mr P. Bandara', subjectSi: 'ගණිතය', forTeacherSi: 'පී. බණ්ඩාර මහතා' };
  const cases = {
    one: () => reliefAssigned({ school, teacherName: 'Mr S. Kumara', teacherNameSi: 'එස්. කුමාර මහතා', date: '2026-11-24', rows: [row], todayUrl }),
    many: () => reliefAssigned({ school, teacherName: 'Mr S. Kumara', date: '2026-11-24', rows: [row, { ...row, period: 5, start: '11:00', end: '11:45', className: '7A', subject: 'Science', subjectSi: undefined }], todayUrl }),
    cancelled: () => reliefCancelled({ school, teacherName: 'Mr S. Kumara', date: '2026-11-24', todayUrl }),
  };

  for (const [name, make] of Object.entries(cases)) {
    it(`${name} snapshot`, () => {
      const { subject, html, text } = make();
      expect({ subject, html, text }).toMatchSnapshot();
    });
    it(`${name} is bilingual and email-safe`, () => {
      const { html, text } = make();
      expect(html).toMatch(/[\u0D80-\u0DFF]/);
      expect(text).toMatch(/[\u0D80-\u0DFF]/);
      expect(html).not.toMatch(/<script|<style|<svg|display:flex|color-mix/);
      expect(html).toContain(todayUrl);
    });
  }

  it('subjects follow the row count', () => {
    expect(cases.one().subject).toBe('Relief today: P3 6B Maths');
    expect(cases.many().subject).toBe('2 relief periods today');
    expect(cases.cancelled().subject).toBe('Relief cancelled today');
  });

  it('lists every row with the covered teacher', () => {
    const { text } = cases.many();
    expect(text).toContain('P3 · 09:15–10:00: 6B · Maths (for Mr P. Bandara)');
    expect(text).toContain('P5 · 11:00–11:45: 7A · Science (for Mr P. Bandara)');
  });
});
