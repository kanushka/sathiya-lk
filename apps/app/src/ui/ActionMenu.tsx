// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { MenuPanel } from './listbox/MenuPanel';
import { usePopover } from './listbox/usePopover';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: IconName;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  label?: string;
  variant?: 'ghost' | 'secondary';
  className?: string;
}

/** A ⋯ button that opens a short list of secondary actions. */
export function ActionMenu({ items, label, variant = 'secondary', className }: ActionMenuProps) {
  const { t } = useTranslation('shell');
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { pos } = usePopover(triggerRef, popRef, open, [items.length], () => setOpen(false));
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const first = enabled[0] ?? 0;
  const last = enabled[enabled.length - 1] ?? 0;

  useEffect(() => {
    if (open && pos) itemRefs.current[active]?.focus();
  }, [open, pos, active]);

  function show(at: 'first' | 'last') {
    if (enabled.length === 0) return;
    setActive(at === 'first' ? first : last);
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function move(step: 1 | -1) {
    const at = enabled.indexOf(active);
    setActive(enabled[(at + step + enabled.length) % enabled.length] ?? first);
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      show(e.key === 'ArrowDown' ? 'first' : 'last');
    }
  }

  function onMenuKeyDown(e: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Home: () => setActive(first),
      End: () => setActive(last),
      Escape: () => close(),
      Tab: () => close(false),
    };
    const run = keys[e.key];
    if (!run) return;
    if (e.key !== 'Tab') e.preventDefault();
    e.stopPropagation();
    run();
  }

  function pick(item: ActionMenuItem) {
    close();
    item.onSelect();
  }

  const anchor = triggerRef.current?.getBoundingClientRect();
  const right = anchor ? Math.max(8, window.innerWidth - anchor.right) : 8;

  return (
    <>
      <IconButton
        ref={triggerRef}
        icon="more"
        label={label ?? t('actionMenu.more')}
        variant={variant}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={enabled.length === 0}
        onClick={() => (open ? close() : show('first'))}
        onKeyDown={onTriggerKeyDown}
        className={cx('h-11 w-11', className)}
      />
      {open && (
        <MenuPanel
          ref={popRef}
          pos={pos}
          anchorRef={triggerRef}
          id={menuId}
          role="menu"
          aria-label={label ?? t('actionMenu.more')}
          onKeyDown={onMenuKeyDown}
          style={{ left: 'auto', right, width: 'auto' }}
          className="min-w-[200px] max-w-[calc(100vw-16px)]"
        >
          {items.map((item, i) => (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              disabled={item.disabled}
              onMouseEnter={() => !item.disabled && setActive(i)}
              onClick={() => pick(item)}
              className={cx(
                'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium',
                'focus-visible:outline-hidden focus-visible:bg-brand/10',
                'disabled:cursor-not-allowed disabled:opacity-[.45]',
                item.tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-surface-2',
              )}
            >
              {item.icon && <Icon name={item.icon} size={18} className="shrink-0" />}
              {item.label}
            </button>
          ))}
        </MenuPanel>
      )}
    </>
  );
}
