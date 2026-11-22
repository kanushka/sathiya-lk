// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

export async function pickOption(user: UserEvent, combobox: HTMLElement, label: string | RegExp) {
  await user.click(combobox);
  await user.click(await screen.findByRole('option', { name: label }));
}
