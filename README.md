# Sathiya

Free timetable web app for Sri Lankan schools.

## Layout

- `apps/web` – public website (Firebase Hosting site `sathiya-lk`)
- `apps/app` – admin/teacher app (Hosting site `sathiya-lk-portal`)
- `packages/core` – domain logic
- `packages/i18n` – translations
- `packages/firebase-config` – Firebase web configs
- `functions` – Cloud Functions
- `docs` – design and plans

## Run

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm test:emulators   # needs Java 17+
pnpm emulators
```

Requires Node 20+ and pnpm 9+.

## Firebase setup

In the Firebase console (project `sathiya-lk`), two Hosting sites: `sathiya-lk` (website, the default site) and `sathiya-lk-portal` (app).
