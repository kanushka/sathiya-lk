# Contributing to Sathiya

Thanks for helping. Sathiya is a free timetable app for Sri Lankan schools, so changes should keep it simple for school admins and teachers, in both Sinhala and English.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues go through [SECURITY.md](SECURITY.md), not public issues.

## Set up

Requirements: Node 22 (`.nvmrc`), pnpm 9, Java 17+ (Firebase emulators).

```bash
pnpm install
pnpm dev:local
```

This starts the emulators, seeds a demo school and runs the app on http://localhost:5173 and the website on http://localhost:4321. Demo logins are in the [README](README.md#quick-start). `pnpm seed` re-seeds running emulators.

## Checks

Run these before opening a PR:

```bash
pnpm check:license
pnpm typecheck
pnpm test
pnpm test:emulators   # if you changed functions, rules, indexes or packages/core
pnpm e2e              # if you changed a user flow
```

## Branches and pull requests

- Branch from `main` and open a PR into `main`. Keep each PR to one change.
- CI (`.github/workflows/ci.yml`) runs:
  - `ci-fast` on every PR: licence headers, typecheck, unit tests, app build, website build and tests.
  - `ci-emulators`: functions and security rules tests. On PRs it runs only when `functions/`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `tests/rules/` or `packages/core/` change.
  - `ci-e2e`: Playwright end-to-end tests. On PRs it runs only when the PR has the `e2e` label; a maintainer can add it.
- All checks must pass before merge. A maintainer reviews and merges.
- Fill in the PR template: what changed, how you tested it, screenshots for UI changes.

## Commits

One line, [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(app): add search to the teacher list
fix(core): count combined classes once in progress
docs: explain the e2e label
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `style`, `chore`, `ci`. Scopes follow the package: `app`, `web`, `functions`, `core`, `i18n`, `e2e`, `rules`.

## Code style

- TypeScript, strict. Follow the style of the surrounding code.
- No comments unless they explain a non-obvious why (a workaround, a hidden constraint). Don't restate the code.
- Every source file (`.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`, `.css`, `.html`, `.astro`, `.rules`) starts with:

  ```ts
  // SPDX-License-Identifier: AGPL-3.0-or-later
  // Copyright (C) 2026 Kanushka Gayan
  ```

  `pnpm check:license` fails without it. Use the comment syntax of the file type.
- Domain logic (clashes, pin mode, plans, publishing) belongs in `packages/core` with tests; the app only renders it.

## UI rules (`apps/app`)

- Use the shared components in `apps/app/src/ui` (`Button`, `Field`, `Select`, `Combobox`, `Modal`, `Tabs`, …). Don't build one-off versions.
- Use popup modals (`Modal`), not side panels.
- Use the brand tokens (`bg-brand`, `text-on-brand`, `brand-2`, `--danger`, …), not hard-coded colours. Each school's colours set these tokens.
- Every user-visible string goes through i18next, with the key in both `packages/i18n/src/en/*.json` and `packages/i18n/src/si/*.json`. The i18n test fails when an English key is missing in Sinhala. Use `_one` / `_other` plurals for counts.
- Keep keyboard and screen reader support: labelled controls, focus handling in dialogs, Esc to close.

## Tests

Tests are expected with every change.

- Work test-first where you can: write a failing test, make it pass, then tidy up.
- Unit tests with Vitest (and Testing Library for components), next to the code as `*.test.ts(x)`.
- Security rules changes need tests in `tests/rules`.
- New or changed user flows need a Playwright spec in `e2e/specs`.

## Translations

Sinhala text should read naturally to Sri Lankan teachers and admins. Native Sinhala speakers are very welcome to review strings in `packages/i18n/src/si/` and the website copy in `apps/web/src/content/si.ts`, and to open PRs or issues with better wording.

## Reporting bugs and proposing features

- **Bugs:** open an issue with the "Bug report" form. Include steps to reproduce, what you expected, what happened, and your browser and device. Never include passwords, real staff IDs or other personal data.
- **Features:** open an issue with the "Feature request" form. Describe the school problem first, then your idea. For larger changes, wait for a maintainer to agree before writing code.
- **Security:** see [SECURITY.md](SECURITY.md).

## Licence

Sathiya is AGPL-3.0-or-later. By contributing, you agree that your contributions are licensed under the same licence.
