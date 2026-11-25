// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

// Asks the maintainer before Claude edits the shared component set in apps/app/src/ui.
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let path = '';
try {
  path = JSON.parse(raw)?.tool_input?.file_path ?? '';
} catch {
  process.exit(0);
}
const p = path.replaceAll('\\', '/');
if (!p.includes('/apps/app/src/ui/') || /\.test\.tsx?$/.test(p)) process.exit(0);
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `${p.slice(p.indexOf('apps/app/src/ui/'))} is part of the shared design system. Changing or adding a component needs the maintainer's OK (see CLAUDE.md).`,
    },
  }),
);
