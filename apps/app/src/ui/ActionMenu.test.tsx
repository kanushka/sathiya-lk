// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';

function setup(over: Partial<ActionMenuItem>[] = []) {
  const print = vi.fn();
  const fill = vi.fn();
  const remove = vi.fn();
  const items: ActionMenuItem[] = [
    { key: 'fill', label: 'Fill with class teacher', onSelect: fill, ...over[0] },
    { key: 'print', label: 'Print', icon: 'print', onSelect: print, ...over[1] },
    { key: 'delete', label: 'Delete', tone: 'danger', onSelect: remove, ...over[2] },
  ];
  renderWithI18n(<ActionMenu items={items} />);
  return { user: userEvent.setup(), print, fill, remove, trigger: screen.getByRole('button', { name: 'More actions' }) };
}

describe('ActionMenu', () => {
  it('is a 44px button that opens a menu of items', async () => {
    const { user, trigger, print } = setup();
    expect(trigger).toHaveClass('h-11', 'w-11');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Fill with class teacher', 'Print', 'Delete']);
    items.forEach((i) => expect(i).toHaveClass('min-h-11'));
    await user.click(screen.getByRole('menuitem', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('moves focus with arrows, Home and End, and picks with Enter', async () => {
    const { user, trigger, remove } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Fill with class teacher' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Print' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Fill with class teacher' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.keyboard('{Home}{End}{Enter}');
    expect(remove).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it('ArrowUp on the trigger opens on the last item', async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
  });

  it('Escape closes and returns focus to the trigger', async () => {
    const { user, trigger, print } = setup();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(print).not.toHaveBeenCalled();
  });

  it('skips disabled items', async () => {
    const { user, trigger, print } = setup([{}, { disabled: true }]);
    await user.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Print' })).toBeDisabled();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    await user.click(screen.getByRole('menuitem', { name: 'Print' }));
    expect(print).not.toHaveBeenCalled();
  });

  it('closes when you press outside', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('marks danger items', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('text-danger');
  });
});
