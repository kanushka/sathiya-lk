// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { test as base, type Locator, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

export type Lang = 'en' | 'si';
export type Text = Record<Lang, string>;

export const WEB_URL = 'http://localhost:4322';
export const OUT = new URL('./out/', import.meta.url).pathname;
const I18N = new URL('../../packages/i18n/src/', import.meta.url).pathname;

const TEAL = '#0E6B6A';
const TEAL_DARK = '#094E4D';
const SAFFRON = '#F2A541';
const CREAM = '#FBFAF7';
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="52" height="52"><rect x="1" y="1" width="32" height="32" rx="8" fill="${CREAM}"/><path d="M8 12h18M8 17h18M8 22h18M14 8v18M20 8v18" stroke="${TEAL}" stroke-width="1.6"/><rect x="20" y="17" width="6" height="5" fill="${SAFFRON}"/></svg>`;
const MARK = `<img width="52" height="52" alt="" src="data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}">`;
const FONT = `Inter,'Noto Sans Sinhala','Sinhala Sangam MN',system-ui,sans-serif`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${({ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' })[c]};`);

export class Tutorial {
  readonly dir: string;
  private readonly frames: Array<{ file: string; at: number }> = [];
  private readonly captions: Array<{ text: string; from: number; to?: number }> = [];
  private readonly stills: string[] = [];
  private readonly cuts: Array<{ from: number; to: number }> = [];
  private caption: { [Symbol.asyncDispose](): Promise<void> } | null = null;
  private t0 = 0;
  private size = { width: 1920, height: 1080 };
  private n = 0;

  constructor(
    readonly page: Page,
    readonly lang: Lang,
    readonly flow: string,
  ) {
    this.dir = `${OUT}${flow}/${lang}/`;
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(`${this.dir}frames`, { recursive: true });
    mkdirSync(`${this.dir}stills`, { recursive: true });
  }

  t(ns: string, key: string, vars: Record<string, string | number> = {}): string {
    const json = JSON.parse(readFileSync(`${I18N}${this.lang}/${ns}.json`, 'utf8')) as Record<string, unknown>;
    const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], json);
    if (typeof v !== 'string') throw new Error(`missing i18n ${this.lang}/${ns}:${key}`);
    return v.replace(/\{\{(\w+)\}\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
  }

  // Matches a translated label, with any placeholder not given in vars matching anything.
  rx(ns: string, key: string, vars: Record<string, string | number> = {}): RegExp {
    const text = this.t(ns, key, vars).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${text.replace(/\\\{\\\{\w+\\\}\\\}/g, '.*')}$`);
  }

  mark(): number {
    return this.now();
  }

  cut(from: number, to = this.now()): void {
    this.cuts.push({ from, to });
  }

  private now(): number {
    return Date.now() - this.t0;
  }

  async start(): Promise<void> {
    this.t0 = Date.now();
    const vp = this.page.viewportSize() ?? { width: 1280, height: 720 };
    const scale = (vp.width > vp.height ? 1920 : 1080) / vp.width;
    this.size = { width: Math.round(vp.width * scale / 2) * 2, height: Math.round(vp.height * scale / 2) * 2 };
    await this.page.screencast.start({
      size: this.size,
      quality: 92,
      onFrame: ({ data }) => {
        const file = `frames/${String(this.n++).padStart(6, '0')}.jpg`;
        writeFileSync(`${this.dir}${file}`, data);
        this.frames.push({ file, at: this.now() });
      },
    });
    await this.page.screencast.showActions({
      cursor: 'pointer',
      duration: 700,
      style: {
        point: `width:34px;height:34px;border-radius:50%;background:rgba(242,165,65,.35);border:2px solid ${SAFFRON}`,
        highlight: `outline:3px solid ${SAFFRON};outline-offset:2px;border-radius:8px`,
        title: 'display:none',
      },
    });
  }

  async card(title: Text, sub: Text, ms = 3500): Promise<void> {
    await this.clearCaption();
    await this.page.mouse.move(1279, 719);
    const cells = [
      [2, 1, SAFFRON, 1], [12, 2, SAFFRON, 1], [13, 2, SAFFRON, 1], [4, 9, SAFFRON, 1],
      [14, 9, CREAM, 0.18], [1, 6, TEAL_DARK, 1], [11, 10, TEAL_DARK, 1], [7, 0, CREAM, 0.18],
    ] as const;
    await this.page.screencast.showOverlay(
      `<div style="position:fixed;inset:0;background:${TEAL};overflow:hidden;font-family:${FONT};color:${CREAM}">
        <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(251,250,247,.14) 2px,transparent 2px),linear-gradient(90deg,rgba(251,250,247,.14) 2px,transparent 2px);background-size:80px 60px"></div>
        ${cells.map(([x, y, c, o]) => `<div style="position:absolute;left:${x * 80 + 2}px;top:${y * 60 + 2}px;width:78px;height:58px;background:${c};opacity:${o}"></div>`).join('')}
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:60px">
          <div style="display:flex;align-items:center;gap:14px;background:${TEAL};padding:10px 22px;border-radius:14px">${MARK}<span style="font-size:26px;font-weight:700;white-space:nowrap">Sathiya <span style="font-weight:600;opacity:.85">· සතිය</span></span></div>
          <div style="background:${TEAL};padding:14px 30px;border-radius:16px;max-width:1040px">
            <div style="font-size:clamp(28px,4.2vw,46px);font-weight:700;line-height:1.3">${esc(title[this.lang])}</div>
            <div style="font-size:clamp(17px,2.4vw,24px);opacity:.92;line-height:1.5;margin-top:10px">${esc(sub[this.lang])}</div>
          </div>
        </div>
      </div>`,
      { duration: ms },
    );
    await this.page.waitForTimeout(ms + 150);
  }

  async say(text: Text, ms?: number): Promise<void> {
    await this.clearCaption();
    const s = text[this.lang];
    this.captions.push({ text: s, from: this.now() });
    this.caption = await this.page.screencast.showOverlay(
      `<div style="position:fixed;left:0;right:0;bottom:28px;display:flex;justify-content:center;pointer-events:none">
        <div style="max-width:min(1080px,calc(100vw - 24px));background:${TEAL};color:${CREAM};font-family:${FONT};font-size:clamp(16px,2.2vw,23px);line-height:1.55;padding:12px 26px;border-radius:12px;border-left:6px solid ${SAFFRON};box-shadow:0 6px 24px rgba(9,78,77,.35)">${esc(s)}</div>
      </div>`,
    );
    await this.page.waitForTimeout(ms ?? Math.min(5500, 1600 + s.length * 45));
  }

  async clearCaption(): Promise<void> {
    if (!this.caption) return;
    await this.caption[Symbol.asyncDispose]();
    this.caption = null;
    const last = this.captions.at(-1);
    if (last && last.to === undefined) last.to = this.now();
  }

  private async focus(target: Locator): Promise<void> {
    await target.waitFor({ timeout: 15_000 });
    await target.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await this.page.waitForTimeout(450);
  }

  async click(target: Locator, pause = 800): Promise<void> {
    await this.focus(target);
    await target.click();
    await this.page.waitForTimeout(pause);
  }

  async type(target: Locator, text: string, pause = 450): Promise<void> {
    await this.focus(target);
    await target.click();
    await target.pressSequentially(text, { delay: 55 });
    await this.page.waitForTimeout(pause);
  }

  async pick(combo: Locator, option: string): Promise<void> {
    await this.click(combo, 600);
    await this.click(this.page.getByRole('option', { name: option, exact: true }), 600);
  }

  async still(name: string): Promise<void> {
    await this.page.screencast.hideOverlays();
    await this.page.screenshot({ path: `${this.dir}stills/${name}.png` });
    await this.page.screencast.showOverlays();
    this.stills.push(name);
  }

  async finish(): Promise<void> {
    await this.clearCaption();
    await this.page.waitForTimeout(300);
    await this.page.screencast.stop();
    writeFileSync(
      `${this.dir}meta.json`,
      JSON.stringify({ flow: this.flow, lang: this.lang, end: this.now(), size: this.size, frames: this.frames, captions: this.captions, stills: this.stills, cuts: this.cuts }, null, 1),
    );
  }
}

export const test = base.extend<{ lang: Lang; tutorial: (flow: string) => Promise<Tutorial> }>({
  lang: ['en', { option: true }],
  tutorial: async ({ page, lang }, use) => {
    await page.addInitScript((l) => localStorage.setItem('sathiya.lang', l), lang);
    let made: Tutorial | undefined;
    await use(async (flow) => {
      made = new Tutorial(page, lang, flow);
      return made;
    });
  },
});
