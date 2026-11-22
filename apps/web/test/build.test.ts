// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_URL, CONTACT_EMAIL, SITE_URL } from '../src/site';
import { robotsTxt, sitemapXml } from '../src/lib/seo';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const APP = APP_URL;

const pages = ['index', 'terms', 'privacy', 'contact'];
const enPaths = pages.map((p) => (p === 'index' ? 'index.html' : `${p}/index.html`));
const siPaths = enPaths.map((p) => `si/${p}`);
const allPaths = [...enPaths, ...siPaths];

const read = (p: string) => readFileSync(join(dist, p), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const attrs = (html: string, tag: string, attr: string) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*\\s${attr}="([^"]*)"`, 'g'))].map((m) => m[1]!);

describe('built site', () => {
  it.each(allPaths)('emits %s', (p) => {
    expect(existsSync(join(dist, p))).toBe(true);
  });

  it.each(allPaths)('%s has the right lang, a title and a meta description', (p) => {
    const html = read(p);
    const lang = p.startsWith('si/') ? 'si' : 'en';
    expect(html).toMatch(new RegExp(`<html[^>]*\\slang="${lang}"`));
    expect(html).toMatch(/<title>[^<\s][^<]*<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"\s][^"]*"/);
  });

  it.each(allPaths)('%s has canonical and hreflang alternates', (p) => {
    const html = read(p);
    const path = '/' + p.replace(/index\.html$/, '');
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}${path}"`);
    expect(html).toContain(`<link rel="alternate" hreflang="en" href="${SITE_URL}/`);
    expect(html).toContain(`<link rel="alternate" hreflang="si" href="${SITE_URL}/si/`);
  });

  it.each(allPaths)('%s has no bare # links and every in-page anchor resolves', (p) => {
    const html = read(p);
    const hrefs = attrs(html, 'a', 'href');
    expect(hrefs).not.toContain('#');
    expect(hrefs).not.toContain('');
    const ids = new Set(attrs(html, '[a-z0-9]+', 'id'));
    for (const h of hrefs.filter((h) => h.startsWith('#'))) {
      expect(ids, `${p} anchor ${h}`).toContain(h.slice(1));
    }
  });

  it.each(['index.html', 'si/index.html'])('%s nav links to features, how-it-works and faq sections', (p) => {
    const html = read(p);
    const nav = html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? '';
    const anchors = attrs(nav, 'a', 'href').filter((h) => h.startsWith('#'));
    expect(anchors).toEqual(expect.arrayContaining(['#features', '#how', '#faq']));
  });

  it.each(['index.html', 'si/index.html'])('%s links to the app register, login and teacher login', (p) => {
    const hrefs = attrs(read(p), 'a', 'href').map((h) => h.replace(/&amp;/g, '&'));
    expect(hrefs).toContain(`${APP}/register`);
    expect(hrefs).toContain(`${APP}/login`);
    expect(hrefs).toContain(`${APP}/login?as=teacher`);
  });

  it.each(allPaths)('%s footer links to report a school', (p) => {
    const footer = read(p).match(/<footer\b[\s\S]*?<\/footer>/)?.[0] ?? '';
    expect(attrs(footer, 'a', 'href')).toContain(`${APP}/login?report=1`);
  });

  it.each(['index.html', 'si/index.html'])('%s FAQ links to report a school', (p) => {
    const faq = read(p).match(/<section id="faq"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(attrs(faq, 'a', 'href')).toContain(`${APP}/login?report=1`);
  });

  it.each(['terms/index.html', 'si/terms/index.html'])('%s links to report a school', (p) => {
    const article = read(p).match(/<article\b[\s\S]*?<\/article>/)?.[0] ?? '';
    expect(attrs(article, 'a', 'href')).toContain(`${APP}/login?report=1`);
  });

  it('terms say fake or duplicate registrations may be suspended', () => {
    expect(read('terms/index.html')).toMatch(/fake or duplicate registrations may be suspended/i);
  });

  it('language switch points at the same page in the other language', () => {
    expect(attrs(read('terms/index.html'), 'a', 'href')).toContain('/si/terms/');
    expect(attrs(read('si/privacy/index.html'), 'a', 'href')).toContain('/privacy/');
  });

  it.each(['terms/index.html', 'si/terms/index.html', 'privacy/index.html', 'si/privacy/index.html'])(
    '%s carries the version and contact email',
    (p) => {
      const html = read(p);
      expect(html).toContain('2026-11-21');
      expect(html).toContain(CONTACT_EMAIL);
      expect(html).not.toContain('[CONTACT EMAIL]');
    },
  );

  it.each(['contact/index.html', 'si/contact/index.html'])('%s links the contact email', (p) => {
    expect(attrs(read(p), 'a', 'href')).toContain(`mailto:${CONTACT_EMAIL}`);
  });

  it.each(allPaths)('%s uses the configured site URL for og:url and og:image', (p) => {
    const html = read(p);
    expect(html).toMatch(new RegExp(`<meta property="og:url" content="${SITE_URL.replace(/\./g, '\\.')}/`));
    expect(html).toContain(`<meta property="og:image" content="${SITE_URL}/og.png"`);
  });

  it('no page mentions the old domain', () => {
    for (const f of walk(dist).filter((f) => f.endsWith('.html'))) {
      expect(readFileSync(f, 'utf8'), relative(dist, f)).not.toMatch(/(?<![\w.])sathiya\.lk\b/);
    }
  });

  it.each(allPaths)('%s does not load gtag eagerly but offers consent', (p) => {
    const html = read(p);
    expect(attrs(html, 'script', 'src').some((s) => s.includes('googletagmanager.com'))).toBe(false);
    expect(html).toContain('G-Z7BE11T4C9');
    expect(html).toContain('sathiya.consent');
  });

  it.each(allPaths)('%s ships under 150 KB of JS', (p) => {
    const html = read(p);
    const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + m[1]!.length, 0);
    const external = attrs(html, 'script', 'src')
      .filter((s) => s.startsWith('/'))
      .reduce((n, s) => n + statSync(join(dist, s)).size, 0);
    expect(inline + external).toBeLessThan(150 * 1024);
  });

  it('emits a noindex bilingual 404 page that links home', () => {
    const p = '404.html';
    expect(existsSync(join(dist, p))).toBe(true);
    const html = read(p);
    expect(html).toMatch(/<html[^>]*\slang="en"/);
    expect(html).toMatch(/<title>[^<\s][^<]*<\/title>/);
    expect(html).toContain('<meta name="robots" content="noindex"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toMatch(/<section lang="si"/);
    const hrefs = attrs(html, 'a', 'href');
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/si/']));
    expect(hrefs).not.toContain('#');
  });

  it('ships og image and favicon', () => {
    expect(existsSync(join(dist, 'og.png'))).toBe(true);
    expect(existsSync(join(dist, 'favicon.svg'))).toBe(true);
    const png = readFileSync(join(dist, 'og.png'));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  it('total emitted JS stays small', () => {
    const js = walk(dist).filter((f) => f.endsWith('.js'));
    const total = js.reduce((n, f) => n + statSync(f).size, 0);
    expect(total, js.map((f) => relative(dist, f)).join(', ')).toBeLessThan(150 * 1024);
  });
});

describe('robots and sitemap', () => {
  const site = SITE_URL;
  const publicPaths = walk(dist)
    .map((f) => relative(dist, f).split('\\').join('/'))
    .filter((f) => f.endsWith('.html') && f !== '404.html')
    .map((p) => '/' + p.replace(/index\.html$/, ''));

  it('emits robots.txt that allows all and points at the sitemap', () => {
    const robots = read('robots.txt');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: \/\S*/m);
    expect(robots).toContain(`Sitemap: ${site}/sitemap.xml`);
  });

  it('emits a sitemap file referenced by robots.txt', () => {
    const files = readdirSync(dist).filter((f) => /^sitemap.*\.xml$/.test(f));
    expect(files).toContain('sitemap.xml');
  });

  it('lists every public page in both languages and nothing else', () => {
    const xml = read('sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    expect(locs.sort()).toEqual(publicPaths.map((p) => `${site}${p}`).sort());
    expect(locs.filter((l) => /\/404(\.html|\/)?$/.test(l))).toEqual([]);
  });

  it.each(publicPaths)('sitemap entry %s has en, si and x-default alternates', (path) => {
    const xml = read('sitemap.xml');
    const entry = xml.match(new RegExp(`<url>\\s*<loc>${(site + path).replace(/[.?]/g, '\\$&')}</loc>[\\s\\S]*?</url>`))?.[0] ?? '';
    const en = path.replace(/^\/si\//, '/');
    const si = en === '/' ? '/si/' : `/si${en}`;
    expect(entry).toContain(`hreflang="en" href="${site}${en}"`);
    expect(entry).toContain(`hreflang="si" href="${site}${si}"`);
    expect(entry).toContain(`hreflang="x-default" href="${site}${en}"`);
  });
});

describe('sitemap and robots follow the site URL', () => {
  it('keeps non-production sites out of search engines', () => {
    expect(robotsTxt('https://staging.example.com')).toBe('User-agent: *\nDisallow: /\n');
  });

  it('escapes the site URL in the sitemap', () => {
    expect(sitemapXml('https://example.com/?a=1&b=2')).not.toMatch(/&(?!amp;)/);
  });

  it('uses the given origin', () => {
    const other = 'https://staging.example.com';
    const xml = sitemapXml(`${other}/`);
    expect(xml).toContain(`<loc>${other}/si/terms/</loc>`);
    expect(xml).not.toContain(SITE_URL);
  });
});
