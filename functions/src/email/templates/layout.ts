// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { onColor, pickName } from '@sathiya/core';

export const SATHIYA_TEAL = '#0E6B6A';
export const SATHIYA_NAVY = '#14213D';
export const BRAND_NAME = 'Sathiya (සතිය)';
const INK = SATHIYA_NAVY;
const MUTED = '#5A6378';
const SOFT = '#3B4560';
const RULE = '#ECEDF1';
const BORDER = '#E4E6EC';
const PAGE = '#FBFAF7';
const TEAL_SOFT = '#CDE7E5';
const SANS = "Inter,'Segoe UI',Helvetica,Arial,'Noto Sans Sinhala','Iskoola Pota','Nirmala UI',sans-serif";
const SINHALA = "'Noto Sans Sinhala','Iskoola Pota','Nirmala UI',Inter,Arial,sans-serif";

const TONES = {
  neutral: { bg: '#F1F2F5', fg: SOFT },
  ok: { bg: '#E1F0EE', fg: '#0B5756' },
  warn: { bg: '#FDF0D8', fg: '#7D520A' },
  bad: { bg: '#FBEAEA', fg: '#A3262A' },
} as const;
export type Tone = keyof typeof TONES;

export const esc = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Only http(s) URLs may reach an href/src; anything else is dropped.
export const safeUrl = (u: string | undefined): string | undefined => {
  if (!u) return undefined;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const hex = (c: string | undefined, fallback: string): string => (c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : fallback);

/** Text with optional bold runs. Plain strings are escaped on output. */
export type Part = string | { b: string };
export type Para = Part | Part[];

export interface Fact {
  label: string;
  value: Para;
  /** Show the value as a status badge. */
  tone?: Tone;
}

export interface Content {
  title: string;
  status?: { tone: 'ok' | 'bad'; badge: string; text: string };
  paras: Para[];
  facts?: Fact[];
  steps?: Para[];
  quoteLabel?: string;
  quote?: string;
  /** `fallback` is the line above the pasteable link under the button. */
  cta?: { label: string; url: string; fallback?: string };
  note?: string;
}

export interface Header {
  name: string;
  /** Second line under the name (stacked lockup). */
  subName?: string;
  primary?: string;
  logoUrl?: string;
  badge?: string;
}

export interface Email {
  subject: string;
  header: Header;
  /** Language shown first, with the button. Default English. */
  lang?: 'en' | 'si';
  en: Content;
  /** Omitted for English-only mail (super admin notices). */
  si?: Content;
  footer: { en: string; si?: string; linkUrl?: string; linkLabel?: string };
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const parts = (p: Para): Part[] => (Array.isArray(p) ? p : [p]);
const partHtml = (p: Part): string => (typeof p === 'string' ? esc(p) : `<b>${esc(p.b)}</b>`);
const partText = (p: Part): string => (typeof p === 'string' ? p : p.b);
const paraHtml = (p: Para): string => parts(p).map(partHtml).join('');
const paraText = (p: Para): string => parts(p).map(partText).join('');

const badge = (label: string, tone: Tone, dot = false, bg?: string): string =>
  `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:${bg ?? TONES[tone].bg};color:${TONES[tone].fg};font-size:12px;font-weight:600;line-height:16px;white-space:nowrap">${dot ? '&#9679;&nbsp;' : ''}${esc(label)}</span>`;

const table = (style: string, rows: string): string =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${style}">${rows}</table>`;

interface Brand {
  bg: string;
  fg: string;
}

interface BlockOpts {
  primary: boolean;
  font: string;
  brand: Brand;
}

function block(c: Content, { primary, font, brand }: BlockOpts): string {
  const size = primary ? 15 : 14;
  const lh = font === SINHALA ? 1.75 : 1.6;
  const rows: string[] = [];
  const p = (html: string, extra = '') => `<p style="margin:0 0 12px;${extra}">${html}</p>`;

  if (primary && c.status) {
    const t = TONES[c.status.tone];
    rows.push(
      table(
        `margin:0 0 16px;background:${t.bg};border-radius:8px`,
        `<tr><td style="padding:12px 14px;font-size:14px;line-height:1.5;color:${t.fg}">${badge(c.status.badge, c.status.tone, true, '#FFFFFF')}&nbsp;&nbsp;${esc(c.status.text)}</td></tr>`,
      ),
    );
  }
  rows.push(
    primary
      ? `<h1 style="margin:0 0 12px;font-size:${font === SINHALA ? 21 : 22}px;line-height:1.3;font-weight:700;color:${INK}">${esc(c.title)}</h1>`
      : `<h2 style="margin:0 0 6px;font-size:17px;line-height:1.35;font-weight:700;color:${INK}">${esc(c.title)}</h2>`,
  );
  for (const para of c.paras) rows.push(p(paraHtml(para)));
  if (c.facts?.length) {
    const cell = `padding:8px 0;border-bottom:1px solid ${RULE};vertical-align:top`;
    rows.push(
      table(
        'margin:4px 0 14px;font-size:14px',
        c.facts
          .map(
            (f) =>
              `<tr><td width="96" style="${cell};width:96px;padding-right:12px;font-weight:600;color:${MUTED}">${esc(f.label)}</td><td style="${cell}">${
                f.tone ? badge(paraText(f.value), f.tone, true) : paraHtml(f.value)
              }</td></tr>`,
          )
          .join(''),
      ),
    );
  }
  if (c.steps?.length) {
    rows.push(
      table(
        'margin:4px 0 16px',
        c.steps
          .map(
            (s, i) =>
              `<tr><td width="24" valign="top" style="width:24px;padding:0 0 10px"><div style="width:24px;height:24px;border-radius:12px;background:${brand.bg};color:${brand.fg};text-align:center;font-family:${SANS};font-size:13px;font-weight:700;line-height:24px">${i + 1}</div></td><td valign="top" style="padding:1px 0 10px 12px">${paraHtml(s)}</td></tr>`,
          )
          .join(''),
      ),
    );
  }
  if (c.quote) {
    if (c.quoteLabel) rows.push(p(esc(c.quoteLabel), `margin-bottom:6px;font-size:13px;font-weight:600;color:${MUTED}`));
    rows.push(
      p(esc(c.quote), `margin-bottom:16px;padding:12px 14px;background:#F6F7F9;border:1px solid ${BORDER};border-radius:8px;color:${SOFT};font-size:14px;white-space:pre-wrap`),
    );
  }
  const url = primary && c.cta ? safeUrl(c.cta.url) : undefined;
  if (c.cta && url) {
    rows.push(
      `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 2px"><tr><td style="background:${brand.bg};border-radius:8px"><a href="${esc(url)}" style="display:inline-block;padding:12px 20px;color:${brand.fg};text-decoration:none;font-weight:600;font-size:15px;line-height:20px">${esc(c.cta.label)}</a></td></tr></table>`,
    );
    if (c.cta.fallback)
      rows.push(
        `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all">${esc(c.cta.fallback)}<br><a href="${esc(url)}" style="color:${SOFT}">${esc(url)}</a></p>`,
      );
  }
  if (c.note) rows.push(`<p style="margin:14px 0 0;font-size:13px;color:${MUTED}">${esc(c.note)}</p>`);
  const color = primary ? INK : SOFT;
  return `<div style="font-family:${font};font-size:${size}px;line-height:${lh};color:${color}">${rows.join('')}</div>`;
}

function divider(label: string, font: string): string {
  const line = `<td width="50%" style="vertical-align:middle"><div style="height:1px;background:${RULE};line-height:1px;font-size:0">&nbsp;</div></td>`;
  return table(
    'margin:24px 0 14px',
    `<tr>${line}<td style="padding:0 10px;white-space:nowrap;font-family:${font}">${badge(label, 'neutral')}</td>${line}</tr>`,
  );
}

function blockText(c: Content, primary: boolean): string[] {
  const out: string[] = [];
  if (primary && c.status) out.push(`[${c.status.badge}] ${c.status.text}`, '');
  out.push(c.title, '', ...c.paras.flatMap((p) => [paraText(p), '']));
  if (c.facts?.length) out.push(...c.facts.map((f) => `${f.label}: ${paraText(f.value)}`), '');
  if (c.steps) out.push(...c.steps.map((s, i) => `${i + 1}. ${paraText(s)}`), '');
  if (c.quote) {
    if (c.quoteLabel) out.push(`${c.quoteLabel}:`);
    out.push(...c.quote.split('\n').map((l) => `> ${l}`), '');
  }
  const url = c.cta ? safeUrl(c.cta.url) : undefined;
  if (primary && c.cta && url) out.push(`${c.cta.label}: ${url}`, '');
  if (c.note) out.push(c.note, '');
  return out;
}

function headerHtml(h: Header, brand: Brand): string {
  const logo = safeUrl(h.logoUrl);
  const subColor = brand.bg.toUpperCase() === SATHIYA_TEAL && brand.fg === '#FFFFFF' ? TEAL_SOFT : brand.fg;
  const nameSize = h.subName && h.name.length > 14 ? 18 : 20;
  const name = `<span style="font-weight:800;font-size:${nameSize}px;letter-spacing:-0.2px;line-height:1.1">${esc(h.name)}</span>`;
  const nameHtml = h.subName
    ? `<span style="display:inline-block;vertical-align:middle;line-height:1.1">${name}<br><span style="font-family:${SINHALA};font-weight:600;font-size:14px;line-height:1.3;color:${subColor}">${esc(h.subName)}</span></span>`
    : `<span style="vertical-align:middle">${name}</span>`;
  const size = h.subName ? 40 : 32;
  const img = logo
    ? `<img src="${esc(logo)}" alt="" width="${size}" height="${size}" style="vertical-align:middle;border:0;margin-right:12px">`
    : '';
  const right = h.badge
    ? `<td align="right" style="vertical-align:middle;padding-left:12px">${badge(h.badge, 'ok', false, PAGE)}</td>`
    : '';
  return table('', `<tr><td style="vertical-align:middle">${img}${nameHtml}</td>${right}</tr>`);
}

export function render(e: Email): Rendered {
  const bg = hex(e.header.primary, SATHIYA_TEAL);
  const brand: Brand = { bg, fg: onColor(bg) };
  const siFirst = e.lang === 'si' && e.si !== undefined;
  const [first, second] = siFirst ? [e.si!, e.en] : [e.en, e.si];
  const [firstFont, secondFont] = siFirst ? [SINHALA, SANS] : [SANS, SINHALA];
  const secondLabel = siFirst ? 'English' : 'සිංහල';

  const link = safeUrl(e.footer.linkUrl);
  const footerLines = [esc(e.footer.en), ...(e.footer.si ? [`<span style="font-family:${SINHALA}">${esc(e.footer.si)}</span>`] : [])];
  if (link) footerLines.push(`<a href="${esc(link)}" style="color:${SOFT}">${esc(e.footer.linkLabel ?? link)}</a>`);

  const html = `<!doctype html>
<html lang="${siFirst ? 'si' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(e.subject)}</title></head>
<body style="margin:0;padding:0;background:${PAGE}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${PAGE}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:520px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;overflow:hidden">
<tr><td style="background:${bg};color:${brand.fg};padding:20px 24px;font-family:${SANS}">${headerHtml(e.header, brand)}</td></tr>
<tr><td style="padding:28px 24px 24px">
${block(first, { primary: true, font: firstFont, brand })}
${second ? `${divider(secondLabel, secondFont)}\n${block(second, { primary: false, font: secondFont, brand })}` : ''}
</td></tr>
</table>
<p style="margin:0;padding:18px 24px 0;text-align:center;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED}">${footerLines.join('<br>')}</p>
</td></tr></table>
</body></html>`;

  const text = [
    ...blockText(first, true),
    ...(second ? ['---', '', ...blockText(second, false)] : []),
    '--',
    e.footer.en,
    ...(e.footer.si ? [e.footer.si] : []),
    ...(link ? [link] : []),
  ].join('\n');

  return { subject: e.subject.replace(/\s*[\r\n]+\s*/g, ' '), html, text };
}

export interface SchoolBrand {
  nameEn: string;
  nameSi?: string;
  logoUrl?: string;
  colors?: { primary?: string };
}

export const schoolHeader = (s: SchoolBrand): Header => {
  const en = s.nameEn?.trim();
  const si = s.nameSi?.trim();
  return {
    name: pickName(s, 'en'),
    subName: en && si && si !== en ? si : undefined,
    primary: s.colors?.primary,
    logoUrl: s.logoUrl,
  };
};

export const schoolFooter = (s: SchoolBrand, extra?: string): Email['footer'] => ({
  en: [`Sent by ${BRAND_NAME} for ${pickName(s, 'en')}.`, extra].filter(Boolean).join(' '),
});

export const brandSubject = (s: string): string => `${s} · ${BRAND_NAME}`;

export const sathiyaHeader: Header = {
  name: 'Sathiya',
  subName: 'සතිය',
  primary: SATHIYA_TEAL,
  logoUrl: 'https://sathiya.kanushka.com/logo-on-teal-96.png',
};
