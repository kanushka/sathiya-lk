// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { PlanItem } from '@sathiya/core';
import { ctx, S } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { pickOption } from '../../test/pickOption';
import { renderWithI18n } from '../../test/render';
import { GroupModal } from './GroupModal';

const initial: Extract<PlanItem, { kind: 'group' }> = {
  kind: 'group',
  key: 'aesthetic',
  nameEn: 'Aesthetic',
  optionSubjectIds: [S.music, S.dancing, S.art, S.pali],
  perWeek: 2,
};

function setup() {
  const onSave = vi.fn();
  renderWithI18n(<GroupModal initial={initial} subjects={ctx.subjects} newKey={() => 'k'} onSave={onSave} onClose={vi.fn()} />);
  return { onSave, user: userEvent.setup() };
}

describe('GroupModal option subjects', () => {
  it('adds an option through the multiselect, removes one through its chip, and saves in pick order', async () => {
    const { onSave, user } = setup();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/^\+\d+$/)).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Remove Dancing' }));
    await pickOption(user, within(dialog).getByRole('combobox', { name: /^Option subjects/ }), 'Tamil (2nd language)');
    await user.click(within(dialog).getByRole('button', { name: 'Save group' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ key: 'aesthetic', optionSubjectIds: [S.music, S.art, S.pali, S.tamil] }));
  });
});
