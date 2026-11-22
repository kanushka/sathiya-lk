// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

function setup() {
  const onClose = vi.fn();
  renderWithI18n(
    <Modal open title="Edit teacher" subtitle="SCC024" onClose={onClose} footer={<button>Save</button>}>
      <input aria-label="Name" />
    </Modal>,
  );
  return { onClose, user: userEvent.setup() };
}

describe('Modal', () => {
  it('close button uses the subtle surface without a transparent override', () => {
    setup();
    const close = screen.getByRole('button', { name: /close/i });
    expect(close).toHaveClass('bg-surface-3');
    expect(close).not.toHaveClass('bg-transparent');
  });

  it('renders a labelled modal dialog', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Edit teacher' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('SCC024')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { onClose, user } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click but not on panel click', async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByLabelText('Name'));
    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape, backdrop and the close button while busy', async () => {
    const onClose = vi.fn();
    renderWithI18n(
      <Modal open busy title="Edit teacher" onClose={onClose}>
        <input aria-label="Name" />
      </Modal>,
    );
    const user = userEvent.setup();
    await user.keyboard('{Escape}');
    await user.click(screen.getByTestId('modal-backdrop'));
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps focus inside the dialog when the clicked button starts loading', async () => {
    function Busy() {
      const [busy, setBusy] = useState(false);
      return (
        <Modal open busy={busy} title="Edit teacher" onClose={() => undefined} footer={<Button loading={busy} onClick={() => setBusy(true)}>Save</Button>}>
          <p>Body</p>
        </Modal>
      );
    }
    renderWithI18n(<Busy />);
    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();
    // Browsers drop focus from a button once it is disabled; jsdom does not, so simulate it.
    save.addEventListener('click', () => save.blur());
    await userEvent.setup().click(save);
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('closes from the close button', async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus inside the dialog', async () => {
    const { user } = setup();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('renders nothing when closed', () => {
    renderWithI18n(
      <Modal open={false} title="Hidden" onClose={() => {}}>
        x
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
