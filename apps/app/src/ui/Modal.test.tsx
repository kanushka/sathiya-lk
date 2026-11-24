// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Modal } from './Modal';
import { installMatchMedia } from '../test/matchMedia';

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

  it('full-screen variant fills the viewport without a centred card', () => {
    renderWithI18n(
      <Modal open fullScreen title="Siripura" subtitle="Admin" closeLabel="Close menu" onClose={() => undefined}>
        <a href="/x">Link</a>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Siripura' });
    expect(dialog).toHaveClass('h-full');
    expect(dialog).not.toHaveClass('rounded-[18px]');
    expect(dialog).not.toHaveStyle({ maxWidth: '560px' });
    expect(screen.getByTestId('modal-backdrop')).toHaveClass('bg-white');
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderWithI18n(
      <Modal open={false} title="Hidden" onClose={() => {}}>
        x
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('inert background', () => {
    function Page({ nested = false }: { nested?: boolean }) {
      const [open, setOpen] = useState(false);
      const [inner, setInner] = useState(false);
      return (
        <>
          <div id="app-root">
            <button onClick={() => setOpen(true)}>Open outer</button>
          </div>
          {createPortal(<div aria-live="polite" data-testid="live" />, document.body)}
          <Modal open={open} title="Outer" onClose={() => setOpen(false)} footer={nested ? <button onClick={() => setInner(true)}>Open inner</button> : null}>
            <input aria-label="Outer field" />
          </Modal>
          <Modal open={inner} title="Inner" onClose={() => setInner(false)}>
            <input aria-label="Inner field" />
          </Modal>
        </>
      );
    }

    it('makes the page behind inert while open and restores it on close', async () => {
      const user = userEvent.setup();
      renderWithI18n(<Page />);
      const root = document.getElementById('app-root') as HTMLElement;
      expect(root.closest('[inert]')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Open outer' }));
      expect(root.closest('[inert]')).not.toBeNull();
      expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();
      expect(screen.getByTestId('live').closest('[inert]')).toBeNull();
      await user.keyboard('{Escape}');
      expect(root.closest('[inert]')).toBeNull();
      expect(document.querySelector('[inert]')).toBeNull();
    });

    it('keeps the outer dialog inert under a nested one until the nested one closes', async () => {
      const user = userEvent.setup();
      renderWithI18n(<Page nested />);
      const root = document.getElementById('app-root') as HTMLElement;
      await user.click(screen.getByRole('button', { name: 'Open outer' }));
      await user.click(screen.getByRole('button', { name: 'Open inner' }));
      const [outer, inner] = screen.getAllByRole('dialog', { hidden: true });
      expect(outer?.closest('[inert]')).not.toBeNull();
      expect(inner?.closest('[inert]')).toBeNull();
      await user.keyboard('{Escape}');
      expect(outer?.closest('[inert]')).toBeNull();
      expect(root.closest('[inert]')).not.toBeNull();
      await user.keyboard('{Escape}');
      expect(document.querySelector('[inert]')).toBeNull();
    });
  });

  describe('on phones', () => {
    let restore: () => void;
    afterEach(() => restore());

    function open(width: number) {
      restore = installMatchMedia(width);
      renderWithI18n(
        <Modal open title="Edit teacher" onClose={() => undefined} footer={<button>Save</button>}>
          <input aria-label="Name" />
        </Modal>,
      );
    }

    it('renders the panel as a bottom sheet', () => {
      open(375);
      expect(screen.getByTestId('modal-backdrop')).toHaveClass('items-end', 'md:items-center');
      expect(screen.getByRole('dialog')).toHaveClass('rounded-t-[18px]', 'max-h-[90dvh]', 'md:rounded-[18px]');
    });

    it('focuses the panel instead of the first input', () => {
      open(375);
      expect(screen.getByRole('dialog', { name: 'Edit teacher' })).toHaveFocus();
    });

    it('still focuses the first input on desktop', () => {
      open(1280);
      expect(screen.getByLabelText('Name')).toHaveFocus();
    });

    it('scrolls tall content inside the body and keeps the footer outside it', () => {
      open(375);
      const body = screen.getByLabelText('Name').parentElement!;
      expect(body).toHaveClass('overflow-y-auto', 'min-h-0');
      expect(body).not.toContainElement(screen.getByRole('button', { name: 'Save' }));
    });
  });
});
