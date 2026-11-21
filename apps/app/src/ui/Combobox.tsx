// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from './cx';
import { Icon } from './Icon';
import { placePopover, type Placement } from './popoverPlacement';

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
}

const LIST_MAX = 288;

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
}: ComboboxProps<T>) {
  const { t } = useTranslation('shell');
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<(Placement & { listMax: number }) | null>(null);

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

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    function reposition() {
      const trigger = triggerRef.current;
      const pop = popRef.current;
      if (!trigger || !pop) return;
      const r = trigger.getBoundingClientRect();
      const list = listRef.current;
      const chrome = pop.offsetHeight - (list?.offsetHeight ?? 0);
      const contentHeight = chrome + Math.min(list?.scrollHeight ?? 0, LIST_MAX);
      const placed = placePopover({
        anchor: { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
        contentHeight,
        viewportHeight: window.innerHeight,
      });
      setPos({ ...placed, listMax: Math.max(0, Math.min(LIST_MAX, placed.maxHeight - chrome)) });
    }
    reposition();
    function onScroll(e: Event) {
      if (e.target instanceof Node && popRef.current?.contains(e.target)) return;
      reposition();
    }
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, flat.length, query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  function openList() {
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
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        className={cx(
          'flex h-11 w-full items-center gap-2.5 rounded-[10px] border-[1.5px] bg-white px-3 text-left text-sm',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
          open ? 'border-brand' : 'border-line-strong',
        )}
      >
        <span className={cx('min-w-0 flex-1 truncate', value === undefined ? 'text-ink-muted' : 'font-semibold text-ink')}>
          {value === undefined ? placeholder : getLabel(value)}
        </span>
        <Icon name="chevronDown" size={16} className="shrink-0 text-ink-muted" />
      </button>
      {open &&
        createPortal(
        <div
          ref={popRef}
          data-combobox-popover=""
          onMouseDown={(e) => {
            if (e.target !== searchRef.current) e.preventDefault();
          }}
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            width: pos?.width,
            opacity: pos ? 1 : 0,
          }}
          className="z-[60] flex flex-col rounded-xl border border-line-strong bg-white p-2 shadow-[0_14px_30px_-18px_rgba(20,33,61,.4)]"
        >
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeItem === undefined ? undefined : optionId(getKey(activeItem))}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-[38px] w-full rounded-lg border border-line-strong pl-8 pr-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={placeholder}
            style={{ maxHeight: pos?.listMax ?? LIST_MAX }}
            className="mt-1 overflow-y-auto"
          >
            {flat.length === 0 && <p className="px-2 py-3 text-sm text-ink-muted">{t('noMatches')}</p>}
            {groups.map((g) => {
              if (g.items.length === 0) return null;
              const options = g.items.map((item) => {
                index += 1;
                const i = index;
                const key = getKey(item);
                const isActive = i === active;
                const selected = key === selectedKey;
                return (
                  <div
                    key={key}
                    id={optionId(key)}
                    role="option"
                    aria-selected={selected}
                    data-active={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(item)}
                    className={cx(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm',
                      isActive && 'bg-[color-mix(in_srgb,var(--brand)_10%,white)]',
                      selected && 'font-semibold',
                    )}
                  >
                    {renderItem ? renderItem(item, { active: isActive, selected }) : getLabel(item)}
                  </div>
                );
              });
              if (!groupBy) return options;
              return (
                <div key={g.name} role="group" aria-label={g.name}>
                  <p
                    aria-hidden="true"
                    className="mx-1.5 mb-1 mt-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-ink-muted"
                  >
                    {g.name}
                  </p>
                  {options}
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
        )}
    </div>
  );
}
