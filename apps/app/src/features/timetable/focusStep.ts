// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

// On phones, focusing a search box pops the on-screen keyboard over the sheet, so focus the sheet instead.
export function focusStep(input: HTMLInputElement | null, isPhone: boolean): void {
  if (!input) return;
  if (isPhone) input.closest<HTMLElement>('[role="dialog"]')?.focus();
  else input.focus();
}
