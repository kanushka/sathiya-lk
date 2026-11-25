# Sathiya: notes for Claude

## UI: stick to the design system

The design source of truth is the "Sathiya Screens" design canvas (https://claude.ai/artifact/Hba3wEy5peivzGi4rAxD96), above all its "Components · unified set" board. `docs/ui/component-audit.md` maps it to code.

- Build every screen from the shared components in `apps/app/src/ui/`: `Button`, `IconButton`, `LinkButton`, `Select`, `Combobox`, `MultiSelect`, `SegmentedControl`, `Tabs`, `Checkbox`, `RadioGroup`, `Switch`, `Field`, `Badge`, `Chip`, `Alert`, `Modal`, `Table`, `PageHeader`, `EmptyState`, `LoadingState`, `Toast`, `Icon`.
- Don't hand-style a native `<button>`, `<select>`, `<input type="checkbox">` or similar control in feature code. Use the component. If one is missing a variant you need, ask first.
- Don't add a new component to `apps/app/src/ui/`, or change how an existing one looks or behaves, without the maintainer's OK. A hook asks before any edit there.
- Use the Tailwind tokens in `apps/app/tailwind.config.ts` (`brand`, `ink`, `line`, `surface`, `success`, `warning`, `danger`). No raw hex colours, new radii or new control heights. Controls are 40px tall (sm 32), with 8px corners on controls, 12px on cards and 18px on modals.
- New icons go in `apps/app/src/ui/Icon.tsx` as stroke icons that match the set.
- A new screen or a big layout change gets a board on the design canvas first. Build it only after the maintainer approves the board.
- When the design doesn't cover a case, stop and ask. Don't invent a new pattern.

## Copy

- Every user-facing string goes in both `packages/i18n/src/en` and `packages/i18n/src/si`. Counts use `_one` / `_other` keys.
- Write short plain sentences. No semicolons in user-facing text.
