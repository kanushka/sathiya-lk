# Sathiya: notes for Claude

## UI: stay on-system

The app has one design system: the components in `apps/app/src/ui/`, drawn on the "Components · unified set" board of the Sathiya Screens canvas (https://claude.ai/artifact/Hba3wEy5peivzGi4rAxD96). Before building or changing a screen, open that board and the screen's own board on the canvas.

- Build every control from a `ui/` component. When one lacks a variant you need, ask the maintainer and wait for a yes before touching `ui/`.
- Take colours from the Tailwind tokens in `apps/app/tailwind.config.ts`. Copy card and section styling from an existing page, such as `features/teachers`.
- Add new icons to `ui/Icon.tsx`, drawn as stroke icons like the rest.
- For a new screen or a big layout change, draw it on the canvas first. Start the code once the maintainer approves the board.
- When neither the canvas nor an existing page covers the case, ask before choosing a pattern.

## Copy

- Every user-facing string lives in both `packages/i18n/src/en` and `packages/i18n/src/si`, with `_one` / `_other` keys for counts.
- Join clauses with a full stop and a new sentence. User-facing text uses no semicolons.
