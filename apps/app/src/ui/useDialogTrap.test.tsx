// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { useDialogTrap } from './useDialogTrap';

function Trap({ name, onClose, children }: { name: string; onClose: () => void; children?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useDialogTrap({ panelRef, containerRef, initialFocusRef: bodyRef, onClose });
  return createPortal(
    <div ref={containerRef}>
      <section ref={panelRef} aria-label={name} tabIndex={-1}>
        <button>{name} header</button>
        <div ref={bodyRef}>
          <button>{name} first</button>
          <button>{name} last</button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function Host({ onClose = () => undefined, nested = false }: { onClose?: () => void; nested?: boolean }) {
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Outside</button>
      {open && (
        <Trap
          name="A"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          {nested && <button onClick={() => setInner(true)}>Open B</button>}
          {inner && <Trap name="B" onClose={() => undefined} />}
        </Trap>
      )}
    </div>
  );
}

describe('useDialogTrap', () => {
  it('focuses the first control in the initial-focus area', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByText('Open'));
    expect(screen.getByText('A first')).toHaveFocus();
  });

  it('makes everything outside inert and locks body scroll', async () => {
    const user = userEvent.setup();
    const { container } = render(<Host />);
    await user.click(screen.getByText('Open'));
    expect(container).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('calls onClose on Escape and restores focus, inert and scroll', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<Host onClose={onClose} />);
    document.body.style.overflow = 'auto';
    await user.click(screen.getByText('Open'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Open')).toHaveFocus();
    expect(container).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('auto');
  });

  it('wraps Tab from the last control to the first', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByText('Open'));
    screen.getByText('A last').focus();
    await user.tab();
    expect(screen.getByText('A header')).toHaveFocus();
  });

  it('only the top trap reacts to Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Host onClose={onClose} nested />);
    await user.click(screen.getByText('Open'));
    await user.click(screen.getByText('Open B'));
    expect(screen.getByText('B first')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});
