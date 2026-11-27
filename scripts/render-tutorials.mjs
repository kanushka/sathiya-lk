// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const OUT = new URL('../e2e/tutorials/out/', import.meta.url).pathname;
const GUIDE = new URL('../apps/web/public/guide/', import.meta.url).pathname;
const only = process.argv[2];

const stamp = (ms) => {
  const t = Math.max(0, Math.round(ms));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(t / 3600000))}:${p(Math.floor(t / 60000) % 60)}:${p(Math.floor(t / 1000) % 60)},${p(t % 1000, 3)}`;
};

for (const flow of readdirSync(OUT)) {
  if ((only && flow !== only) || !statSync(`${OUT}${flow}`).isDirectory()) continue;
  for (const lang of readdirSync(`${OUT}${flow}`)) {
    const dir = `${OUT}${flow}/${lang}/`;
    if (!existsSync(`${dir}meta.json`)) continue;
    const meta = JSON.parse(readFileSync(`${dir}meta.json`, 'utf8'));
    const cuts = meta.cuts ?? [];
    const inCut = (t) => cuts.some((c) => t >= c.from && t < c.to);
    const shift = (t) => t - cuts.reduce((sum, c) => sum + Math.max(0, Math.min(t, c.to) - c.from), 0);
    const frames = meta.frames.filter((f) => !inCut(f.at)).map((f) => ({ ...f, at: shift(f.at) }));
    const end = shift(meta.end);
    const start = frames[0].at;
    const list = frames.flatMap((f, i) => {
      const next = frames[i + 1]?.at ?? end;
      return [`file '${f.file}'`, `duration ${Math.max(0.001, (next - f.at) / 1000).toFixed(3)}`];
    });
    list.push(`file '${frames.at(-1).file}'`);
    writeFileSync(`${dir}frames.txt`, `${list.join('\n')}\n`);

    const { width: w, height: h } = meta.size ?? { width: 1920, height: 1080 };
    const mp4 = `${dir}${flow}.${lang}.mp4`;
    execFileSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'frames.txt',
        '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
        '-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`,
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'stillimage',
        '-c:a', 'aac', '-shortest', '-movflags', '+faststart', mp4],
      { cwd: dir, stdio: 'inherit' },
    );

    const srt = meta.captions
      .map((c) => ({ text: c.text, from: shift(c.from) - start, to: shift(c.to ?? meta.end) - start }))
      .filter((c) => c.to > c.from)
      .map((c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}\n`)
      .join('\n');
    writeFileSync(`${dir}${flow}.${lang}.srt`, srt);

    const stills = `${GUIDE}${flow}/${lang}/`;
    mkdirSync(stills, { recursive: true });
    for (const s of meta.stills) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}stills/${s}.png`, '-vf', `scale=min(${w > h ? 1440 : 720}\\,iw):-2:flags=lanczos`, `${stills}${s}.png`]);
    }
    console.log(`${flow} ${lang}: ${mp4}`);
  }
}
