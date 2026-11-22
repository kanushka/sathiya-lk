// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { spawn } from 'node:child_process';
import { closeSync, ftruncateSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';

const APP_PORT = 5173;
const WEB_PORT = 4321;
const APP_URL = `http://localhost:${APP_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const children = [];
let stopping = false;

// The emulator reads functions/.env.local over functions/.env, so mail links point at the local app and website.
// A file whose first line is the marker is ours, possibly left behind by a crash, so it is safe to overwrite.
const ENV_LOCAL = new URL('../functions/.env.local', import.meta.url);
const MARKER = '# dev-local';
function claimEnvLocal() {
  let fd;
  try {
    fd = openSync(ENV_LOCAL, 'wx');
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    fd = openSync(ENV_LOCAL, 'r+');
    if (readFileSync(fd, 'utf8').split('\n', 1)[0] !== MARKER) {
      closeSync(fd);
      return false;
    }
    ftruncateSync(fd);
  }
  writeSync(fd, `${MARKER}\nAPP_URL=${APP_URL}\nWEB_URL=${WEB_URL}\n`, 0);
  closeSync(fd);
  return true;
}
const wroteEnvLocal = claimEnvLocal();
if (!wroteEnvLocal) console.warn('functions/.env.local already exists; mail links use its values');

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
  if (wroteEnvLocal) rmSync(ENV_LOCAL, { force: true });
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
  env: { VITE_USE_EMULATORS: 'true', VITE_APPCHECK_SITE_KEY: '', VITE_WEB_URL: WEB_URL },
});
run('web', ['--filter', 'web', 'exec', 'astro', 'dev', '--port', String(WEB_PORT)], {
  env: { PUBLIC_APP_URL: APP_URL },
});

console.log(`
  App:          ${APP_URL}
  Website:      ${WEB_URL}
  Emulator UI:  http://127.0.0.1:4000
  Ctrl-C stops everything.
`);
