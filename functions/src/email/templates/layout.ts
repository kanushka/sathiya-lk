// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { onColor } from '@sathiya/core';

export const SATHIYA_TEAL = '#0E6B6A';
export const SATHIYA_NAVY = '#14213D';
const INK = SATHIYA_NAVY;
const MUTED = '#5A6378';
const SOFT = '#3B4560';
const RULE = '#ECEDF1';
const FOOT = '#8A91A3';
const PAGE = '#FBFAF7';
const SANS = "Inter,'Segoe UI',Helvetica,Arial,'Noto Sans Sinhala','Iskoola Pota','Nirmala UI',sans-serif";
const SINHALA = "'Noto Sans Sinhala','Iskoola Pota','Nirmala UI',Inter,Arial,sans-serif";

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

export interface Content {
  greeting: string;
  paras: Para[];
  steps?: Para[];
  quote?: string;
  cta?: { label: string; url: string };
  note?: string;
}

export interface Header {
  name: string;
  primary?: string;
  logoUrl?: string;
}

export interface Email {
  subject: string;
  header: Header;
  en: Content;
  si: Content;
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

function block(c: Content, font: string, withButton: boolean, size: number): string {
  const rows: string[] = [];
  const pad = (html: string, extra = '') => `<p style="margin:0 0 12px;${extra}">${html}</p>`;
  rows.push(pad(esc(c.greeting)));
  for (const p of c.paras) rows.push(pad(paraHtml(p)));
  if (c.quote)
    rows.push(
      `<p style="margin:0 0 12px;padding:10px 14px;background:${PAGE};border-left:3px solid ${RULE};color:${SOFT};white-space:pre-wrap">${esc(c.quote)}</p>`,
    );
  if (c.steps)
    rows.push(
      `<ol style="margin:0 0 12px;padding-left:20px">${c.steps.map((s) => `<li style="margin:0 0 6px">${paraHtml(s)}</li>`).join('')}</ol>`,
    );
  const url = withButton && c.cta ? safeUrl(c.cta.url) : undefined;
  if (c.cta && url) {
    rows.push(
      `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 4px"><tr><td style="background:${SATHIYA_TEAL};border-radius:10px"><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px">${esc(c.cta.label)}</a></td></tr></table>`,
    );
  }
  if (c.note) rows.push(`<p style="margin:12px 0 0;font-size:13px;color:${MUTED}">${esc(c.note)}</p>`);
  return `<div style="font-family:${font};font-size:${size}px;line-height:1.6">${rows.join('')}</div>`;
}

function blockText(c: Content, withLink: boolean): string[] {
  const out = [c.greeting, '', ...c.paras.flatMap((p) => [paraText(p), ''])];
  if (c.quote) out.push(...c.quote.split('\n').map((l) => `> ${l}`), '');
  if (c.steps) out.push(...c.steps.map((s, i) => `${i + 1}. ${paraText(s)}`), '');
  const url = c.cta ? safeUrl(c.cta.url) : undefined;
  if (c.cta && url && withLink) out.push(`${c.cta.label}: ${url}`, '');
  if (c.note) out.push(c.note, '');
  return out;
}

export function render(e: Email): Rendered {
  const bg = hex(e.header.primary, SATHIYA_TEAL);
  const fg = onColor(bg);
  const logo = safeUrl(e.header.logoUrl);
  const headerInner = logo
    ? `<img src="${esc(logo)}" alt="" width="28" height="28" style="vertical-align:middle;border:0;margin-right:10px"><span style="vertical-align:middle">${esc(e.header.name)}</span>`
    : esc(e.header.name);
  const link = safeUrl(e.footer.linkUrl);
  const footerHtml = [
    esc(e.footer.en),
    e.footer.si ? esc(e.footer.si) : '',
    link ? ` <a href="${esc(link)}" style="color:${FOOT}">${esc(e.footer.linkLabel ?? link)}</a>` : '',
  ]
    .filter(Boolean)
    .join('<br>')
    .replace('<br> <a', ' · <a');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(e.subject)}</title></head>
<body style="margin:0;padding:0;background:#E9E8E3">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${PAGE}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:520px;background:#FFFFFF;border:1px solid ${RULE};border-radius:12px;overflow:hidden">
<tr><td style="background:${bg};color:${fg};padding:18px 24px;font-family:${SANS};font-weight:800;font-size:18px">${headerInner}</td></tr>
<tr><td style="padding:24px;color:${INK}">
${block(e.en, SANS, true, 15)}
<div style="border-top:1px solid ${RULE};margin-top:20px;padding-top:16px;color:${SOFT}">${block(e.si, SINHALA, false, 14)}</div>
</td></tr>
</table>
<p style="margin:0;padding:16px 24px 0;text-align:center;font-family:${SANS};font-size:12px;line-height:1.6;color:${FOOT}">${footerHtml}</p>
</td></tr></table>
</body></html>`;

  const text = [
    ...blockText(e.en, true),
    '---',
    '',
    ...blockText(e.si, false),
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

export const schoolHeader = (s: SchoolBrand): Header => ({ name: s.nameEn, primary: s.colors?.primary, logoUrl: s.logoUrl });
export const sathiyaHeader: Header = { name: 'Sathiya', primary: SATHIYA_TEAL };
