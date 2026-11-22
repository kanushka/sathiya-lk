// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isComposing } from './composing';
import { cx } from './cx';
import { fieldBaseClass, fieldFocusClass } from './Field';
import { Icon } from './Icon';
import { MenuEmpty, MenuGroup, MenuOption, MenuPanel, MenuSearch } from './listbox/MenuPanel';
import { filterOptions, firstEnabled, groupOptions, isPrintable, navigateIndex } from './listbox/options';
import { usePopover } from './listbox/usePopover';
import { useFieldLabelId } from './listbox/useFieldLabelId';
import { useTypeahead } from './listbox/useTypeahead';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
  group?: string;
  hint?: string;
}

export interface SelectProps<V extends string = string> {
  options: SelectOption<V>[];
  value: V | '' | undefined;
  onChange: (value: V) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  size?: 'sm' | 'md';
  className?: string;
  renderOption?: (o: SelectOption<V>, state: { active: boolean; selected: boolean }) => ReactNode;
}

export function Select<V extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  searchable = options.length > 8,
  searchPlaceholder,
  id,
  name,
  disabled,
  required,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  size = 'md',
  className,
  renderOption,
}: SelectProps<V>) {
  const { t } = useTranslation('shell');
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const ordered = useMemo(() => groupOptions(options).flatMap((g) => g.options), [options]);
  const groups = useMemo(() => groupOptions(filterOptions(ordered, query)), [ordered, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const selected = ordered.find((o) => o.value === value);
  const searchLabel = searchPlaceholder ?? t('search');

  const { pos, listMax } = usePopover(triggerRef, popRef, open, [flat.length], () => setOpen(false));
  const typeahead = useTypeahead(flat, setActive);

  const fieldLabelId = useFieldLabelId(triggerRef, open && !ariaLabelledBy && !ariaLabel, baseId);

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);

  function openList() {
    if (disabled) return;
    const sel = ordered.findIndex((o) => o.value === value && !o.disabled);
    setQuery('');
    setActive(sel >= 0 ? sel : firstEnabled(ordered, 0, 1));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }

  function pick(o: SelectOption<V> | undefined) {
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  }

  function onOpenKeyDown(e: KeyboardEvent) {
    const next = navigateIndex(e.key, flat, active);
    if (next !== null) {
      e.preventDefault();
      setActive(next);
      return;
    }
    switch (e.key) {
      case 'Enter':
        if (isComposing(e)) return;
        e.preventDefault();
        pick(flat[active]);
        return;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      case 'Tab':
        close(searchable);
        return;
      case ' ':
        if (searchable) return;
        e.preventDefault();
        pick(flat[active]);
        return;
    }
    if (!searchable && isPrintable(e)) {
      e.preventDefault();
      typeahead(e.key, active);
    }
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    if (open) {
      if (!searchable) onOpenKeyDown(e);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      if (e.key === 'Enter' && isComposing(e)) return;
      e.preventDefault();
      openList();
    } else if (!searchable && isPrintable(e)) {
      e.preventDefault();
      openList();
      typeahead(e.key, ordered.findIndex((o) => o.value === value));
    }
  }

  const optionId = (v: string) => `${baseId}-opt-${v}`;
  const activeOption = flat[active];
  const activeId = activeOption ? optionId(activeOption.value) : undefined;
  let index = -1;

  return (
    <div className={cx('relative', className)}>
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable ? activeId : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        onKeyUp={(e) => {
          if (e.key === ' ') e.preventDefault();
        }}
        className={cx(
          fieldBaseClass,
          fieldFocusClass,
          'flex items-center gap-2 text-left',
          size === 'sm' ? 'h-8' : 'h-10',
        )}
      >
        <span className={cx('min-w-0 flex-1 truncate', !selected && 'text-ink-muted')}>
          {selected ? selected.label : (placeholder ?? t('select.placeholder'))}
        </span>
        <Icon name="chevronDown" size={16} className="shrink-0 text-ink-muted" />
      </button>
      {name !== undefined && <input type="hidden" name={name} value={value ?? ''} />}
      {open && (
        <MenuPanel
          ref={popRef}
          pos={pos}
          onMouseDown={(e) => {
            if (e.target !== searchRef.current) e.preventDefault();
          }}
        >
          {searchable && (
            <MenuSearch
              ref={searchRef}
              label={searchLabel}
              listId={listId}
              activeId={activeId}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(firstEnabled(filterOptions(ordered, e.target.value), 0, 1));
              }}
              onKeyDown={onOpenKeyDown}
            />
          )}
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy ?? (ariaLabel ? undefined : fieldLabelId)}
            style={{ maxHeight: listMax }}
            className="overflow-y-auto"
          >
            {flat.length === 0 && <MenuEmpty>{t('noMatches')}</MenuEmpty>}
            {groups.map((g) => {
              const rows = g.options.map((o) => {
                index += 1;
                const i = index;
                const isActive = i === active;
                const isSelected = o.value === value;
                return (
                  <MenuOption
                    key={o.value}
                    id={optionId(o.value)}
                    active={isActive}
                    selected={isSelected}
                    disabled={o.disabled}
                    onHover={() => setActive(i)}
                    onPick={() => pick(o)}
                  >
                    {renderOption ? (
                      renderOption(o, { active: isActive, selected: isSelected })
                    ) : (
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 truncate">{o.label}</span>
                        {o.hint && <span className="shrink-0 text-xs font-normal text-ink-muted">{o.hint}</span>}
                      </span>
                    )}
                  </MenuOption>
                );
              });
              return g.name ? (
                <MenuGroup key={g.name} label={g.name}>
                  {rows}
                </MenuGroup>
              ) : (
                rows
              );
            })}
          </div>
        </MenuPanel>
      )}
    </div>
  );
}
