// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { PRODUCTION_SITE_URL } from '../site';
import { pagePath, type Lang, type Page } from './links';

export const PUBLIC_PAGES: Page[] = ['index', 'terms', 'privacy', 'contact', 'guide', 'guide/register-school', 'guide/subjects', 'guide/grades', 'guide/templates', 'guide/teachers', 'guide/timetable-class', 'guide/profile', 'guide/members', 'guide/import', 'guide/timetable-teacher', 'guide/autofill', 'guide/publish-print', 'guide/teacher-phone'];
const LANGS: Lang[] = ['en', 'si'];

const abs = (site: string, path: string) => new URL(path, `${site.replace(/\/+$/, '')}/`).href;
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(site: string): string {
  const urls = PUBLIC_PAGES.flatMap((page) => {
    const link = (hreflang: string, lang: Lang) =>
      `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${xml(abs(site, pagePath(lang, page)))}"/>`;
    const alternates = [...LANGS.map((l) => link(l, l)), link('x-default', 'en')].join('\n');
    return LANGS.map((lang) => `  <url>\n    <loc>${xml(abs(site, pagePath(lang, page)))}</loc>\n${alternates}\n  </url>`);
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function robotsTxt(site: string): string {
  if (new URL(site).origin !== new URL(PRODUCTION_SITE_URL).origin) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${abs(site, '/sitemap.xml')}\n`;
}
