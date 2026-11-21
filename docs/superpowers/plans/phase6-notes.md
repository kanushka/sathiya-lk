# Phase 6 notes — Integration

## Run it locally

```bash
pnpm install
pnpm dev:local
```

Builds functions, starts the emulators (auth, firestore, storage, functions + UI), seeds them, then runs the app (vite dev, `VITE_USE_EMULATORS=true`, App Check off) and the website (astro dev, app links pointing at the local app). Ctrl-C stops everything. Needs Java (emulators) and free ports 4000, 4321, 5001, 5173, 8080, 9099, 9199.

| What | URL |
|---|---|
| App | http://localhost:5173 |
| Website | http://localhost:4321 |
| Emulator UI | http://127.0.0.1:4000 |

Seeded logins (emulator-only test values, defined in `scripts/seed.ts`):

| Role | Where | Login |
|---|---|---|
| School admin | `/login` → Admin login | `admin@siripura.example.com` / `admin-pass-1` |
| Teacher | `/login?as=teacher`, school "Siripura Central College" | staff ID `SCC024` (Mrs. N. Perera) / `teach234` |
| Teacher | same school | staff ID `SCC011` (Mr. R. Silva) / `teach234` |
| Super admin | `/login` → Admin login (lands on `/super`) | `super@sathiya.example.com` / `super-pass-1` |

All 19 fixture teachers exist with password `teach234` (`pnpm seed` prints the list). The seeded year 2027 is a draft, so teachers see "Not published yet" until the admin publishes it from the dashboard.

`pnpm seed` re-seeds running emulators at any time (it wipes the emulator's Firestore and Auth data first). Project id `sathiya-lk` (the app's Firebase config is fixed to it); the seed refuses to run unless the emulator hosts are local.

## End-to-end tests

```bash
pnpm --filter e2e exec playwright install chromium   # once
pnpm e2e
```

Builds functions, runs `firebase emulators:exec` (auth, firestore, storage, functions), and inside it Playwright (`e2e/`, chromium, one worker). Playwright's global setup re-seeds the emulators, then builds the app in emulator mode into `apps/app/dist-e2e` and serves it with `vite preview` on port 4173. Specs run in file order (`e2e/specs/0N-*.spec.ts`); each re-uses the seed or makes its own school, except that later class/teacher grids include earlier specs' edits. Screenshots of key screens go to `e2e/__screenshots__/` (gitignored).

Against an already running stack (`pnpm dev:local`): `E2E_BASE_URL=http://localhost:5173 pnpm --filter e2e test` (re-seeds, so local edits are wiped). Not part of root `pnpm test`; CI runs it as the last steps of the `ci` job.
