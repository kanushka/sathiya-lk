// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { qrSvgDataUri } from './qr';
import type { SlipData, SlipLabels } from './slip';

export interface PrintLabels extends SlipLabels {
  heading: string;
  hint: string;
  title: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildSlipsHtml(slips: SlipData[], qrs: string[], labels: PrintLabels): string {
  const cards = slips
    .map(
      (s, i) => `<article>
<h2>${esc(s.schoolName)}</h2>
<p class="name">${esc(s.name)}</p>
<p>${esc(labels.staffId)}: <b>${esc(s.staffId)}</b></p>
<p>${esc(labels.password)}: <b class="${s.password ? 'pw' : 'reset'}">${esc(s.password ?? labels.resetNeeded)}</b></p>
<img src="${esc(qrs[i] ?? '')}" alt="" width="96" height="96">
<p class="url">${esc(s.url)}</p>
</article>`,
    )
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(labels.title)}</title><style>
body{font-family:system-ui,sans-serif;margin:16px}
main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
article{border:1px dashed #888;border-radius:8px;padding:12px;break-inside:avoid;font-size:13px}
h2{font-size:14px;margin:0 0 6px}p{margin:3px 0}.name{font-weight:700}.pw{font-family:monospace;font-size:16px;letter-spacing:.08em}.reset{color:#B4441C}.url{font-size:11px;color:#555;word-break:break-all}
</style></head><body><main>
${cards}
</main></body></html>`;
}

export async function printSlips(slips: SlipData[], labels: PrintLabels): Promise<boolean> {
  const qrs = await Promise.all(slips.map((s) => qrSvgDataUri(s.url)));
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(buildSlipsHtml(slips, qrs, labels));
  win.document.close();
  win.focus();
  win.print();
  return true;
}
