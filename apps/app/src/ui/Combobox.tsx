// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isComposing } from './composing';
import { cx } from './cx';
import { fieldBaseClass, fieldFocusClass } from './Field';
import { Icon } from './Icon';
import { MenuEmpty, MenuGroup, MenuOption, MenuPanel, MenuSearch } from './listbox/MenuPanel';
import { triggerLabelledBy, useFieldLabelId } from './listbox/useFieldLabelId';
import { usePopover } from './listbox/usePopover';

export interface ComboboxProps<T> {
  items: T[];
  getKey: (t: T) => string;
  getLabel: (t: T) => string;
  groupBy?: (t: T) => string;
  renderItem?: (t: T, state: { active: boolean; selected: boolean }) => ReactNode;
  value?: T;
  onChange: (t: T) => void;
  placeholder: string;
  searchPlaceholder: string;
  id?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  className?: string;
}

interface Group<T> {
  name: string;
  items: T[];
}

export function Combobox<T>({
  items,
  getKey,
  getLabel,
  groupBy,
  renderItem,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  id,
  disabled,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-labelledby': ariaLabelledBy,
  className,
}: ComboboxProps<T>) {
  const { t } = useTranslation('shell');
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const groups = useMemo<Group<T>[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? items.filter((it) => getLabel(it).toLowerCase().includes(q)) : items;
    if (!groupBy) return [{ name: '', items: matches }];
    const byName = new Map<string, T[]>();
    for (const it of matches) {
      const g = groupBy(it);
      const list = byName.get(g);
      if (list) list.push(it);
      else byName.set(g, [it]);
    }
    return [...byName].map(([name, list]) => ({ name, items: list }));
  }, [items, query, getLabel, groupBy]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const selectedKey = value === undefined ? null : getKey(value);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const fieldLabelId = useFieldLabelId(triggerRef, !ariaLabelledBy, baseId);
  const { pos, listMax } = usePopover(triggerRef, popRef, open, [flat.length, query], () => setOpen(false));

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  function openList() {
    if (disabled) return;
    setQuery('');
    setActive(0);
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(item: T) {
    onChange(item);
    close();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(a + 1, flat.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (isComposing(e)) return;
      e.preventDefault();
      const item = flat[active];
      if (item !== undefined) pick(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  }

  const optionId = (key: string) => `${baseId}-opt-${key}`;
  const activeItem = flat[active];
  let index = -1;

  return (
    <div className={cx('relative', className)}>
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={triggerLabelledBy({
          ariaLabelledBy,
          triggerId: baseId,
          valueId: `${baseId}-value`,
          hasValue: value !== undefined,
        })}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        className={cx(fieldBaseClass, fieldFocusClass, 'flex h-10 items-center gap-2 text-left')}
      >
        <span id={`${baseId}-value`} className={cx('min-w-0 flex-1 truncate', value === undefined && 'text-ink-muted')}>
          {value === undefined ? placeholder : getLabel(value)}
        </span>
        <Icon name="chevronDown" size={16} className="shrink-0 text-ink-muted" />
      </button>
      {open && (
        <MenuPanel
          ref={popRef}
          pos={pos}
          data-combobox-popover=""
          onMouseDown={(e) => {
            if (e.target !== searchRef.current) e.preventDefault();
          }}
        >
          <MenuSearch
            ref={searchRef}
            label={searchPlaceholder}
            listId={listId}
            activeId={activeItem === undefined ? undefined : optionId(getKey(activeItem))}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabelledBy || fieldLabelId ? undefined : placeholder}
            aria-labelledby={ariaLabelledBy ?? fieldLabelId}
            style={{ maxHeight: listMax }}
            className="overflow-y-auto"
          >
            {flat.length === 0 && <MenuEmpty>{t('noMatches')}</MenuEmpty>}
            {groups.map((g) => {
              if (g.items.length === 0) return null;
              const options = g.items.map((item) => {
                index += 1;
                const i = index;
                const key = getKey(item);
                const isActive = i === active;
                const selected = key === selectedKey;
                return (
                  <MenuOption
                    key={key}
                    id={optionId(key)}
                    active={isActive}
                    selected={selected}
                    onHover={() => setActive(i)}
                    onPick={() => pick(item)}
                  >
                    {renderItem ? renderItem(item, { active: isActive, selected }) : getLabel(item)}
                  </MenuOption>
                );
              });
              if (!groupBy) return options;
              return (
                <MenuGroup key={g.name} label={g.name}>
                  {options}
                </MenuGroup>
              );
            })}
          </div>
        </MenuPanel>
      )}
    </div>
  );
}
