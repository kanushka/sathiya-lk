import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const APP = 'https://app.sathiya.lk';

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
    expect(html).toContain(`<link rel="canonical" href="https://sathiya.lk${path}"`);
    expect(html).toMatch(/<link rel="alternate" hreflang="en" href="https:\/\/sathiya\.lk\//);
    expect(html).toMatch(/<link rel="alternate" hreflang="si" href="https:\/\/sathiya\.lk\/si\//);
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

  it('language switch points at the same page in the other language', () => {
    expect(attrs(read('terms/index.html'), 'a', 'href')).toContain('/si/terms/');
    expect(attrs(read('si/privacy/index.html'), 'a', 'href')).toContain('/privacy/');
  });

  it.each(['terms/index.html', 'si/terms/index.html', 'privacy/index.html', 'si/privacy/index.html'])(
    '%s carries the version and contact placeholder',
    (p) => {
      const html = read(p);
      expect(html).toContain('2026-11-21');
      expect(html).toContain('[CONTACT EMAIL]');
    },
  );

  it.each(['contact/index.html', 'si/contact/index.html'])('%s shows the contact placeholder', (p) => {
    expect(read(p)).toContain('[CONTACT EMAIL]');
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
