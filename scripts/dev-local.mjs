// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { spawn } from 'node:child_process';

const APP_PORT = 5173;
const WEB_PORT = 4321;
const children = [];
let stopping = false;

function run(name, args, { env = {}, onLine } = {}) {
  // Own process group, so stopping reaches the grandchildren (java emulators, vite, astro).
  const child = spawn('pnpm', args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        console.log(`[${name}] ${line}`);
        onLine?.(line);
      }
    });
  }
  const done = new Promise((resolve) => child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0))));
  done.then((code) => {
    if (!stopping && name !== 'seed' && name !== 'build') {
      console.error(`[${name}] exited (${code}); stopping everything`);
      stop(1);
    }
  });
  return { child, done };
}

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  const alive = children.filter((c) => c.exitCode === null && c.signalCode === null);
  for (const c of alive) {
    try {
      process.kill(-c.pid, 'SIGINT');
    } catch {}
  }
  const timer = setTimeout(() => {
    for (const c of alive) {
      try {
        process.kill(-c.pid, 'SIGKILL');
      } catch {}
    }
  }, 15000);
  await Promise.all(alive.map((c) => new Promise((r) => (c.exitCode !== null || c.signalCode !== null ? r() : c.on('exit', r)))));
  clearTimeout(timer);
  process.exit(code);
}

process.on('SIGINT', () => void stop(0));
process.on('SIGTERM', () => void stop(0));

if ((await run('build', ['--filter', 'functions', 'build']).done) !== 0) await stop(1);

let ready;
const emulatorsReady = new Promise((r) => (ready = r));
run('emu', ['exec', 'firebase', 'emulators:start', '--only', 'auth,firestore,storage,functions', '--project', 'sathiya-lk'], {
  onLine: (l) => l.includes('All emulators ready') && ready(),
});
await emulatorsReady;

if ((await run('seed', ['seed']).done) !== 0) await stop(1);

run('app', ['--filter', 'app', 'exec', 'vite', '--port', String(APP_PORT), '--strictPort'], {
  env: { VITE_USE_EMULATORS: 'true', VITE_APPCHECK_SITE_KEY: '' },
});
run('web', ['--filter', 'web', 'exec', 'astro', 'dev', '--port', String(WEB_PORT)], {
  env: { PUBLIC_APP_URL: `http://localhost:${APP_PORT}` },
});

console.log(`
  App:          http://localhost:${APP_PORT}
  Website:      http://localhost:${WEB_PORT}
  Emulator UI:  http://127.0.0.1:4000
  Ctrl-C stops everything.
`);
